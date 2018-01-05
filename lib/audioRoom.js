const AV = require('leancloud-storage')
const router = require('koa-router')()
const jwt = require('../lib/jwt')
const _ = require('lodash')
const moment = require('moment')
const socket = require('../lib/socket')
const log4js = require('koa-log4')
const logger = log4js.getLogger('router')
const util = require('./util')

class Room {
  // 获取用户所在房间
  constructor(roomId) {
    // this.roomId = roomId
    this.getRoomInfoById(roomId).then((Room) => {
      this.background = Room.get('background')
      this.conversation = Room.get('conversation')
      this.grade = Room.get('grade')
      this.icon = Room.get('icon')
      this.owner = Room.get('owner')
      this.pwd = Room.get('pwd')
      this.roomNumber = Room.get('roomNumber')
      this.tag = Room.get('tag')
      this.title = Room.get('title')
      this.position = Room.get('position')
    })
  }

  createRoom(title, owner) {
    return new Promise(async(resolve, reject) => {
      try {
        let Room = AV.Object.new('AudioRoomInfo')
        Room.set('title', title)
        let Owner = AV.Object.createWithoutData('_User', owner)
        Room.set('owner', Owner)
        let conversation = AV.Object.new('_Conversation')
        conversation.set('tr', true)
        let conv = await conversation.save()
        Room.set('conversation', conv)
        let file = AV.Object.createWithoutData('_File', '5a041363a22b9d00629c7250')
        let file2 = AV.Object.createWithoutData('_File', '5a041467a22b9d00629c8549')
        Room.set('background', file)
        Room.set('icon', file2)
        let roomNumber = await this.makeRoomNumber()
        Room.set('roomNumber', roomNumber)
        let query1 = new AV.Query('_User')
        query1.equalTo('objectId', owner)
        let user = await query1.first()
        let levelGrade = user.get('level') * 1
        Room.set('grade', levelGrade)
        let roomResult = await Room.save()
        resolve(roomResult)
      } catch (err) {
        reject(`createRoom err ->${err}`)
      }
    })
  }

  getRoomInfoById(roomId) {
    return new Promise(async(resolve, reject) => {
      try {
        let query = new AV.Query('AudioRoomInfo')
        query.equalTo('objectId', roomId)
        let Room = await query.first()
        console.log(`ROOM ->${JSON.stringify(Room)}`)
        if (Room) {
          resolve(Room)
        }
        throw new Error(`getRoomInfoById err`)
      } catch (err) {
        reject(err)
      }
    })
  }

  //通过 roomId 获取房间的所有信息
  getRoomById(roomId) {
    return new Promise(async(resolve, reject) => {
      try {
        let queryInfo = new AV.Query('AudioRoomInfo')
        queryInfo.equalTo('objectId', roomId)
        queryInfo.include('conversation')
        queryInfo.include('background')
        queryInfo.include('icon')
        queryInfo.include('owner')
        let RoomInfo = await queryInfo.first()
        RoomInfo.set('owner', util.getUserInfo(RoomInfo.get('owner')))
        RoomInfo.set('background', RoomInfo.get('background').get('url'))
        RoomInfo.set('icon', RoomInfo.get('icon').get('url'))
        RoomInfo.set('conversation', RoomInfo.get('conversation').get('objectId'))

        let roomInfo = AV.Object.createWithoutData('AudioRoomInfo', roomId)
        let queryMember = new AV.Query('AudioRoomMember')
        queryMember.equalTo('room', roomInfo)
        queryMember.include('user')
        let Room = await queryMember.find()
        let member = await Room.map((item, index) => {
          return util.getUserInfo(item.get('user'))
        })
        let data = {
          roomInfo: RoomInfo,
          roomMember: member
        }
        resolve(data)
      } catch (err) {
        reject(`getRoomById err ->${err}`)
      }
    })
  }

  //报人上麦
  addMember(roomId, userId, position) {
    return new Promise(async(resolve, reject) => {
      try {
        let positionIsAvailable = await this.positionAvailable(roomId, position)
        if (!positionIsAvailable) {
          reject('无效的位置')
        }
        let User = AV.Object.createWithoutData('_User', userId)
        let Room = AV.Object.createWithoutData('AudioRoomInfo', roomId)
        let roomPosition = await this.setPosition(roomId, position, 1)
        Room.set('position', roomPosition)
        let RoomMember = AV.Object.new('AudioRoomMember')
        RoomMember.set('room', Room)
        RoomMember.set('user', User)
        RoomMember.set('position', position)
        let ret = await RoomMember.save()
        resolve(ret)
      } catch (err) {
        reject(`addMember err ->${err}`)
      }
    })
  }

  //判断位置是否可用
  positionAvailable(roomId, position) {
    return new Promise(async(resolve, reject) => {
      try {
        let query = new AV.Query('AudioRoomInfo')
        query.equalTo('objectId', roomId)
        query.select('position')
        let roomPosition = await query.first()
        if (roomPosition.get('position')[position - 1] == 1) {
          resolve(false)
        } else {
          resolve(true)
        }
      } catch (err) {
        reject(`positionAvailable err ->${err}`)
      }
    })
  }

  //当有人进出时使用
  //进 type = 1 出 type = 0
  setPosition (position, type){
    return new Promise(async(resolve, reject) => {
      try{
        // let query = new AV.Query('AudioRoomInfo')
        // query.equalTo('objectId', roomId)
        // let Room = await query.first()
        console.log(`this.position --->${this.position}`)
        let roomPosition = this.position
        roomPosition[position - 1] = type
        resolve(roomPosition)
      }catch(err){
        reject(`setPosition err ->${err}`)
      }
    })
  }

  userRoom(userId) {
    return new Promise(async(resolve, reject) => {
      let query1 = new AV.Query('AudioRoom')
      query1.containedIn('member', [userId])
      let query2 = new AV.Query('AudioRoom')
      query2.equalTo('owner', userId)
      let query = AV.Query.or(query1, query2)
      query.include('icon')
      let room = await query.first()
      if (!room) {
        resolve({})
      }
      let isHost = room.get('owner') == userId
      let icon = room.get('icon').get('url')
      let data = {
        roomId: room.get('objectId'),
        title: room.get('title'),
        roomNub: room.get('roomNub'),
        isHost: isHost,
        icon: icon
      }
      resolve(data)
    })
  }

  makeRoomNumber() {
    return new Promise((resolve, reject) => {
      try {
        let query = new AV.Query('AudioRoomInfo')
        query.addDescending('roomNumber')
        query.first().then((room) => {
          if (!room) {
            resolve(10001)
          } else {
            resolve(Number(room.get('roomNumber')) + 1)
          }
        })
      } catch (err) {
        reject(`makeRoomNumber err is ${err}`)
      }
    })
  }

}

module.exports = Room
