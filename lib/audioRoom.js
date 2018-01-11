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
    if (roomId) {
      this.roomId = roomId
      return new Promise(async(resolve, reject) => {
        try {
          this.getRoomInfoById().then((Room) => {
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
            resolve(this)
          }).catch((err) => {
            reject(`no room`)
          })
        } catch (err) {
          reject(`constructor err ->${err}`)
        }
      })
    }
  }

  //创建房间
  createRoom(title, owner, pwd) {
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
        //这两个默认的图片要不要改
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
        if (pwd) {
          Room.set('pwd', pwd)
        }
        let roomResult = await Room.save()
        let query = new AV.Query('AudioRoomInfo')
        query.equalTo('objectId', roomResult.get('objectId'))
        query.include('background')
        query.include('icon')
        query.include('owner')
        let roomInfo = await query.first()
        let data = await this.dealWithRoomData(roomInfo)
        resolve(data)
      } catch (err) {
        reject(`createRoom err ->${err}`)
      }
    })
  }

  getRoomInfoById() {
    return new Promise(async(resolve, reject) => {
      try {
        let query = new AV.Query('AudioRoomInfo')
        query.equalTo('objectId', this.roomId)
        let Room = await query.first()
        if (Room) {
          resolve(Room)
        }
        throw new Error(`no room`)
      } catch (err) {
        reject(err)
      }
    })
  }

  //通过 roomId 获取房间的所有信息
  getRoom(roomId) {
    return new Promise(async(resolve, reject) => {
      try {
        if (!roomId) {
          roomId = this.roomId
        }
        let queryInfo = new AV.Query('AudioRoomInfo')
        queryInfo.equalTo('objectId', roomId)
        queryInfo.include('conversation')
        queryInfo.include('background')
        queryInfo.include('icon')
        queryInfo.include('owner')
        let RoomInfo = await queryInfo.first()
        let data = await this.dealWithRoomData(RoomInfo)
        resolve(data)
      } catch (err) {
        reject(`getRoomById err ->${err}`)
      }
    })
  }

  //获取所有房间列表
  getAllRooms(limit, skip) {
    return new Promise(async(resolve, reject) => {
      try {
        let promise = []
        let query = new AV.Query('AudioRoomInfo')
        query.addDescending('createdAt')
        query.include('owner')
        query.limit(limit)
        query.skip(skip)
        let roomList = await query.find()
        roomList.forEach((item, index) => {
          promise.push(new Promise(async(resolve, reject) => {
            let RoomInfo = await this.dealWithRoomData(item)
            resolve(RoomInfo)
          }))
        })
        let data = await Promise.all(promise)
        resolve(data)
      } catch (err) {
        reject(`get all rooms err ->${err}`)
      }
    })
  }

  dealWithRoomData(RoomInfo) {
    return new Promise(async(resolve, reject) => {
      try {
        RoomInfo.set('owner', util.getUserInfo(RoomInfo.get('owner')))
        RoomInfo.set('background', RoomInfo.get('background').get('url'))
        RoomInfo.set('icon', RoomInfo.get('icon').get('url'))
        RoomInfo.set('conversation', RoomInfo.get('conversation').get('objectId'))

        let room = AV.Object.createWithoutData('AudioRoomInfo', RoomInfo.get('objectId'))
        let queryMember = new AV.Query('AudioRoomMember')
        queryMember.equalTo('room', room)
        queryMember.include('user')
        let RoomMember = await queryMember.find()
        let arr = RoomMember.filter((item, index) => {
          return item.get('position') !== '0'
        })
        let member = await arr.map((item, index) => {
          let userinfo = util.getUserInfo(item.get('user'))
          userinfo.position = item.get('position')
          return userinfo
        })
        RoomInfo.set('count', RoomMember.length)
        let data = {
          roomInfo: RoomInfo,
          roomMember: member
        }
        resolve(data)
      } catch (err) {
        reject(`deal with room data err->${err}`)
      }
    })
  }

  getAudience() {
    return new Promise(async(resolve, reject) => {
      try {
        let room = AV.Object.createWithoutData('AudioRoomInfo', this.roomId)
        let queryMember = new AV.Query('AudioRoomMember')
        queryMember.equalTo('room', room)
        queryMember.equalTo('position', '0')
        queryMember.include('user')
        let Room = await queryMember.find()
        let member = await Room.map((item, index) => {
          let userinfo = util.getUserInfo(item.get('user'))
          userinfo.position = item.get('position')
          return userinfo
        })
        resolve(member)
      } catch (err) {
        reject(`getAudience err ->${err}`)
      }
    })
  }

  //报人上麦
  addMember(userId, position) {
    return new Promise(async(resolve, reject) => {
      try {
        let positionIsAvailable = await this.positionAvailable(position)
        if (!positionIsAvailable) {
          reject('无效的位置')
        }
        let User = AV.Object.createWithoutData('_User', userId)
        let Room = AV.Object.createWithoutData('AudioRoomInfo', this.roomId)
        let roomPosition = await this.setPosition(position, 1)
        Room.set('position', roomPosition)
        let RoomMember = AV.Object.new('AudioRoomMember')
        RoomMember.set('room', Room)
        RoomMember.set('user', User)
        RoomMember.set('position', position)
        let ret = await RoomMember.save()
        let query = new AV.Query('AudioRoomInfo')
        query.equalTo('objectId', this.roomId)
        query.include('owner')
        let room = await query.first()
        let data = await this.dealWithRoomData(room)
        resolve(data)
      } catch (err) {
        reject(`addMember err ->${err}`)
      }
    })
  }

  //退出房间
  deleteUser(userId) {
    return new Promise(async(resolve, reject) => {
      try {
        let room = AV.Object.createWithoutData('AudioRoomInfo', this.roomId)
        let user = AV.Object.createWithoutData('_User', userId)
        let query = new AV.Query('AudioRoomMember')
        query.equalTo('room', room)
        query.equalTo('user', user)
        let ret = await query.first()
        if (ret) {
          let obj = AV.Object.createWithoutData('AudioRoomMember', ret.get('objectId'))
          let deleteRet = await obj.destroy()
          resolve(deleteRet)
        }
        throw new Error(`not in room`)
      } catch (err) {
        reject(`delete a user func err->${err}`)
      }
    })
  }

  //判断位置是否可用
  positionAvailable(position) {
    return new Promise(async(resolve, reject) => {
      try {
        if (this.position[position - 1] == 1) {
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
  setPosition(position, type) {
    return new Promise(async(resolve, reject) => {
      try {
        let roomPosition = this.position
        roomPosition[position - 1] = type
        resolve(roomPosition)
      } catch (err) {
        reject(`setPosition err ->${err}`)
      }
    })
  }

  //查看用户在不在房间
  userRoom(userId) {
    return new Promise(async(resolve, reject) => {
      try {
        let query = new AV.Query('AudioRoomMember')
        let user = AV.Object.createWithoutData('_User', userId)
        query.equalTo('user', user)
        query.include('room')
        query.select('room')
        let room = await query.first()
        //作为房主或者副房主
        //(副)房主能不能加入其他房间
        //如果加入的话,自己的房间怎么办
        if (room) {
          let data = {
            roomId: room.get('objectId'),
            title: room.get('title'),
            roomNub: room.get('roomNub'),
            isHost: isHost,
            icon: icon
          }
          resolve(data)
        }
      } catch (err) {
        reject(`userRoom err ->${err}`)
      }
    })
  }

  //获取房间号码
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
