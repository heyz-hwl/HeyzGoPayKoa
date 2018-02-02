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
      return new Promise(async (resolve, reject) => {
        try {
          this.getRoomInfoById().then((Room) => {
            this.background = Room.get('background')
            this.icon = Room.get('icon')
            this.conversation = Room.get('conversation')
            this.grade = Room.get('grade')
            this.pwd = Room.get('pwd')
            this.roomNumber = Room.get('roomNumber')
            this.tag = Room.get('tag')
            this.title = Room.get('title')
            this.position = Room.get('position')
            this.ownerOnline = Room.get('ownerOnline')
            this.owner = Room.get('owner')
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

  getRoomInfoById(roomId) {
    return new Promise(async (resolve, reject) => {
      try {
        if (!roomId) {
          roomId = this.roomId
        }
        let query = new AV.Query('AudioRoomInfo')
        query.equalTo('objectId', roomId)
        query.include('background')
        query.include('icon')
        query.include('owner')
        let Room = await query.first()
        if (Room) {
          Room.set('background', Room.get('background').get('url'))
          Room.set('icon', Room.get('icon').get('url'))
          Room.set('conversation', Room.get('conversation').get('objectId'))
          Room.set('owner', util.getUserInfo(Room.get('owner')))
          Room.set('roomId', Room.get('objectId'))
          resolve(Room)
        }
        throw new Error(`no room`)
      } catch (err) {
        reject(`getRoomInfoById err ->${err}`)
      }
    })
  }

  //创建房间
  createRoom(title, owner, pwd) {
    return new Promise(async (resolve, reject) => {
      try {
        let Owner = AV.Object.createWithoutData('_User', owner)
        let query = new AV.Query('AudioRoomInfo')
        query.equalTo('owner', Owner)
        let ret = await query.first()
        if (ret) { //已经有自己的房间了
          if (ret.get('ownerOnline')) { //已经在房间里
            return reject('你已经在房间里了')
          }
          //不在房间->回到房间
          let Room = AV.Object.createWithoutData('AudioRoomInfo', ret.get('objectId'))
          Room.set('ownerOnline', true)
          await Room.save()
          //查看房间有没有被展示出来
          let query = new AV.Query('AudioRoomDisplay')
          query.equalTo('room', Room)
          let roomDisplay = await query.first()
          if (!roomDisplay) { // 没有的话->display
            let RoomDisplay = AV.Object.new('AudioRoomDisplay')
            RoomDisplay.set('room', Room)
            await RoomDisplay.save()
          } //有的话直接返回
          let data = await this.getRoomInfoById(ret.get('objectId'))
          return resolve(data)
        }
        let Room = AV.Object.new('AudioRoomInfo')
        Room.set('title', title)
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
        Room.set('pwd', pwd)
        let roomResult = await Room.save()
        let RoomDisplay = AV.Object.new('AudioRoomDisplay')
        RoomDisplay.set('room', Room)
        await RoomDisplay.save()
        let data = await this.getRoomInfoById(roomResult.get('objectId'))
        resolve(data)
      } catch (err) {
        reject(`createRoom err ->${err}`)
      }
    })
  }

  //通过 roomId 获取房间的所有信息
  getMember(roomId, audience) {
    return new Promise(async (resolve, reject) => {
      try {
        if (!roomId) {
          roomId = this.roomId
        }
        let promise = []
        let room = AV.Object.createWithoutData('AudioRoomInfo', roomId)
        let query = new AV.Query('AudioRoomMember')
        // query.addDescending('level')
        query.equalTo('room', room)
        if (audience) {
          query.notEqualTo('position', '0')
        }
        query.include('user')
        let member = await query.find()
        let users = member.map((item, index) => {
          let user = util.getUserInfo(item.get('user'))
          user.position = item.get('position')
          return user
        })
        resolve(users)
      } catch (err) {
        reject(`getMember err ->${err}`)
      }
    })
  }

  //获取所有房间列表
  getAllRooms(limit, skip) {
    return new Promise(async (resolve, reject) => {
      try {
        let query = new AV.Query('AudioRoomDisplay')
        query.select('room')
        query.addDescending('createdAt')
        query.limit(limit)
        query.skip(skip)
        let roomList = await query.find()
        let promise = []
        roomList.forEach((item, index) => {
          promise.push(new Promise(async (resolve, reject) => {
            let Room = await this.getRoomInfoById(item.get('room').get('objectId'))
            let room = await this.dealWithRoomData(Room)
            resolve(room)
          }))
        })
        let RoomList = await Promise.all(promise)
        resolve(RoomList)
      } catch (err) {
        reject(`get all rooms err ->${err}`)
      }
    })
  }

  getOwneRoom(userId) {
    return new Promise(async (resolve, reject) => {
      try {
        let owner = AV.Object.createWithoutData('_User', userId)
        let query = new AV.Query('AudioRoomInfo')
        query.equalTo('owner', owner)
        let Room = await query.first()
        if (Room) {
          let room = this.getRoomInfoById(Room.get('objectId'))
          resolve(room)
        }
        resolve({})
      } catch (err) {
        reject(`getOwneRoom err ->${err}`)
      }
    })
  }

  //处理房间列表数据
  dealWithRoomData(Room) {
    return new Promise(async (resolve, reject) => {
      try {
        let room = AV.Object.createWithoutData('AudioRoomInfo', Room.get('objectId'))
        let query = new AV.Query('AudioRoomMember')
        query.equalTo('room', room)
        let count = await query.count()
        if (Room.get('ownerOnline')) {
          Room.set('count', count + 1)
        } else {
          Room.set('count', count)
        }
        query.limit(4)
        query.include('user')
        let member = await query.find()
        let users = member.map((item, index) => {
          return util.getUserInfo(item.get('user'))
        })
        Room.set('member', users)
        Room.set('roomId', Room.get('objectId'))
        resolve(Room)
      } catch (err) {
        reject(`deal with room data err->${err}`)
      }
    })
  }

  getRoomUsers() {
    return new Promise(async (resolve, reject) => {
      try {
        let room = AV.Object.createWithoutData('AudioRoomInfo', this.roomId)
        let queryMember = new AV.Query('AudioRoomMember')
        queryMember.equalTo('room', room)
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

  //房间加人
  addMember(userId) {
    return new Promise(async (resolve, reject) => {
      try {
        if (userId === this.owner.userId) {
          let room = AV.Object.createWithoutData('AudioRoomInfo', this.roomId)
          room.set('ownerOnline', true)
          await room.save()
          //房主加入房间时,如果该方面没有被显示则显示
          let query = new AV.Query('AudioRoomDisplay')
          query.equalTo('room', room)
          let roomDisplay = await query.first()
          if (!roomDisplay) {
            let RoomDisplay = AV.Object.new('AudioRoomDisplay')
            RoomDisplay.set('room', Room)
            await RoomDisplay.save()
          }
          resolve({})
        } else {
          let User = AV.Object.createWithoutData('_User', userId)
          let Room = AV.Object.createWithoutData('AudioRoomInfo', this.roomId)
          let RoomMember = AV.Object.new('AudioRoomMember')
          RoomMember.set('room', Room)
          RoomMember.set('user', User)
          RoomMember.set('position', '0')
          let ret = await RoomMember.save()
          resolve(ret.get('room').get('objectId'))
        }
      } catch (err) {
        reject(`addMember err ->${err}`)
      }
    })
  }

  //退出房间
  deleteUser(userId) {
    return new Promise(async (resolve, reject) => {
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
          //最后一个人退出,取消展示
          await this.roomNoDisplay()
          resolve(deleteRet)
        }
        throw new Error(`not in room`)
      } catch (err) {
        reject(`delete a user func err->${err}`)
      }
    })
  }

  ownerOffline() {
    return new Promise(async (resolve, reject) => {
      try {
        let room = AV.Object.createWithoutData('AudioRoomInfo', this.roomId)
        room.set('ownerOnline', false)
        let ret = await room.save()
        await this.roomNoDisplay()
        resolve(ret)
      } catch (err) {
        reject(`ownerOffline err ->${err}`)
      }
    })
  }

  roomNoDisplay() {
    return new Promise(async (resolve, reject) => {
      try {
        let room = AV.Object.createWithoutData('AudioRoomInfo', this.roomId)
        let queryCount = new AV.Query('AudioRoomMember')
        queryCount.equalTo('room', room)
        queryCount.notEqualTo('position', '0')
        let count = await queryCount.count()
        let Room = await this.getRoomInfoById(this.roomId)
        if (count === 0 && !Room.get('ownerOnline')) { //房主退出后没有人在麦上
          let query = new AV.Query('AudioRoomDisplay')
          query.equalTo('room', room)
          let roomdis = await query.first()
          if (roomdis) {
            let RoomDisplay = AV.Object.createWithoutData('AudioRoomDisplay', roomdis.get('objectId'))
            await RoomDisplay.destroy()
            return resolve(`no display`)
          }
        }
        resolve('still display')
      } catch (err) {
        reject(`roomNoDisplay err ->${err}`)
      }
    })
  }

  roomDisplay() {
    return new Promise(async (resolve, reject) => {
      try {
        let room = AV.Object.createWithoutData('AudioRoomInfo', this.roomId)
        let query = new AV.Query('AudioRoomMember')
        query.equalTo('room', room)
        query.notEqualTo('position', '0')
        let count = await query.count()
        let Room = await this.getRoomInfoById(this.roomId)
        if ((count === 1 && !Room.get('ownerOnline')) || (count === 0 && Room.get('ownerOnline'))) { //如果当前房间里上麦的只有一个人的话并且房主不在,或者麦上没人房主在线,显示房间
          let query = new AV.Query('AudioRoomDisplay')
          query.equalTo('room', room)
          let roomDisplay = await query.first()
          if (!roomDisplay) {
            let RoomDisplay = AV.Object.new('AudioRoomDisplay')
            let Room = AV.Object.createWithoutData('AudioRoomInfo', this.roomId)
            RoomDisplay.set('room', Room)
            await RoomDisplay.save()
            resolve(`display`)
          }
        }
        resolve(`already display`)
      } catch (err) {
        reject(`roomDisplay err ->${err}`)
      }
    })
  }

  //判断位置是否可用
  positionAvailable(position) {
    return new Promise(async (resolve, reject) => {
      try {
        if (position === '0') {
          return resolve(true)
        }
        let query = new AV.Query('AudioRoomMember')
        let room = AV.Object.createWithoutData('AudioRoomInfo', this.roomId)
        query.equalTo('room', room)
        query.equalTo('position', position)
        let ret = await query.first()
        if (this.position[position - 1] == 1 || ret) {
          resolve(false)
        } else {
          resolve(true)
        }
      } catch (err) {
        reject(`positionAvailable err ->${err}`)
      }
    })
  }

  //锁 type = 1 解锁 type = 0
  setPosition(position, type) {
    return new Promise(async (resolve, reject) => {
      try {
        let roomPosition = this.position
        roomPosition[position - 1] = type
        let room = AV.Object.createWithoutData('AudioRoomInfo', this.roomId)
        room.set('position', roomPosition)
        let ret = await room.save()
        resolve(ret)
      } catch (err) {
        reject(`setPosition err ->${err}`)
      }
    })
  }

  //设置房间成员的位置
  setUserPosition(userId, position) {
    return new Promise(async (resolve, reject) => {
      try {
        let positionIsAvailable = await this.positionAvailable(position)
        if (!positionIsAvailable) {
          return reject('无效的位置')
        }
        let user = AV.Object.createWithoutData('_User', userId)
        let query = new AV.Query('AudioRoomMember')
        let room = AV.Object.createWithoutData('AudioRoomInfo', this.roomId)
        query.equalTo('user', user)
        query.equalTo('room', room)
        let roomMemberEntity = await query.first()
        if (!roomMemberEntity) {
          return reject(`not in room`)
        }
        let roomMember = AV.Object.createWithoutData('AudioRoomMember', roomMemberEntity.get('objectId'))
        roomMember.set('position', position)
        let ret = await roomMember.save()
        // 上麦成功
        if (ret && position !== '0') {
          await this.roomDisplay()
          return resolve(ret)
        } else if (ret && position == '0') {
          await this.roomNoDisplay()
          return resolve(ret)
        }
        reject(`set user position err ->${err}`)
      } catch (err) {
        reject(`set user position err ->${err}`)
      }
    })
  }

  //查看用户在不在房间
  userRoom(userId) {
    return new Promise(async (resolve, reject) => {
      try {
        let user = AV.Object.createWithoutData('_User', userId)
        let queryInfo = new AV.Query('AudioRoomInfo')
        queryInfo.equalTo('owner', user)
        queryInfo.equalTo('ownerOnline', true)
        let ret = await queryInfo.first()
        if (ret) {
          return resolve({
            status: 201,
            data: {
              roomId: ret.get('objectId'),
              roomNumber: ret.get('roomNumber')
            },
            msg: `owner in room`
          })
        }
        let queryMember = new AV.Query('AudioRoomMember')
        queryMember.equalTo('user', user)
        queryMember.include('room')
        let ret2 = await queryMember.first()
        if (ret2) {
          return resolve({
            status: 202,
            data: {
              roomId: ret2.get('room').get('objectId'),
              roomNumber: ret2.get('room').get('roomNumber')
            },
            msg: `member in room`
          })
        }
        resolve({
          status: 203,
          data: {},
          msg: `not in room`
        })
      } catch (err) {
        reject(`userRoom err ->${err}`)
      }
    })
  }

  //获取房间号码
  makeRoomNumber() {
    return new Promise(async (resolve, reject) => {
      try {
        let query = new AV.Query('AudioRoomInfo')
        query.addDescending('roomNumber')
        let room = await query.first()
        if (!room) {
          resolve(10001)
        } else {
          resolve(Number(room.get('roomNumber')) + 1)
        }
      } catch (err) {
        reject(`makeRoomNumber err is ${err}`)
      }
    })
  }

  hasRight(operatorId) {
    return new Promise(async (resolve, reject) => {
      try {
        let user = AV.Object.createWithoutData('_User', operatorId)
        let query = new AV.Query('AudioRoomMember')
        query.equalTo('user', user)
        query.equalTo('position', '-1')
        let viceOwner = await query.first()
        if (operatorId === this.owner.userId) { //房主
          resolve(true)
        } else if (!_.isUndefined(viceOwner)) { //副房主
          resolve(true)
        } else {
          resolve(false)
        }
      } catch (err) {
        reject(`right err ->${err}`)
      }
    })
  }
}

module.exports = Room
