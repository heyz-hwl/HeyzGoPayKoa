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
    return new Promise(async(resolve, reject) => {
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
          resolve(Room)
        }
        throw new Error(`no room`)
      } catch (err) {
        reject(err)
      }
    })
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
        let data = await this.getRoomInfoById(roomResult.get('objectId'))
        resolve(data)
      } catch (err) {
        reject(`createRoom err ->${err}`)
      }
    })
  }

  //通过 roomId 获取房间的所有信息
  getMember(roomId, audience) {
    return new Promise(async(resolve, reject) => {
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
    return new Promise(async(resolve, reject) => {
      try {
        let promise = []
        let query = new AV.Query('AudioRoomInfo')
        query.addDescending('createdAt')
        query.include('owner')
        query.include('background')
        query.include('icon')
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

  //处理房间列表数据
  dealWithRoomData(Room) {
    return new Promise(async(resolve, reject) => {
      try {
        Room.set('background', Room.get('background').get('url'))
        Room.set('icon', Room.get('icon').get('url'))
        Room.set('conversation', Room.get('conversation').get('objectId'))
        Room.set('owner', util.getUserInfo(Room.get('owner')))

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
        let promise = []
        let users = member.map((item, index) => {
          return util.getUserInfo(item.get('user'))
        })
        Room.set('member', users)
        resolve(Room)
      } catch (err) {
        reject(`deal with room data err->${err}`)
      }
    })
  }

  getRoomUsers() {
    return new Promise(async(resolve, reject) => {
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
    return new Promise(async(resolve, reject) => {
      try {
        let User = AV.Object.createWithoutData('_User', userId)
        let Room = AV.Object.createWithoutData('AudioRoomInfo', this.roomId)
        let RoomMember = AV.Object.new('AudioRoomMember')
        RoomMember.set('room', Room)
        RoomMember.set('user', User)
        RoomMember.set('position', '0')
        let ret = await RoomMember.save()
        resolve(ret)
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

  ownerOffline() {
    return new Promise(async(resolve, reject) => {
      try {
        let room = AV.Object.createWithoutData('AudioRoomInfo', this.roomId)
        room.set('ownerOnline', false)
        let ret = await room.save()
        resolve(ret)
      } catch (err) {
        reject(`ownerOffline err ->${err}`)
      }
    })
  }

  //判断位置是否可用
  positionAvailable(position) {
    return new Promise(async(resolve, reject) => {
      try {
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

  //设置房间成员的位置
  setUserPosition(userId, position) {
    return new Promise(async(resolve, reject) => {
      try {
        let positionIsAvailable = await this.positionAvailable(position)
        if (!positionIsAvailable) {
          reject('无效的位置')
        }
        let user = AV.Object.createWithoutData('_User', userId)
        let query = new AV.Query('AudioRoomMember')
        let room = AV.Object.createWithoutData('AudioRoomInfo', this.roomId)
        query.equalTo('user', user)
        query.equalTo('room', room)
        let roomMemberEntity = await query.first()
        if (!roomMemberEntity) {
          reject(`not in room`)
        }
        let roomMember = AV.Object.createWithoutData('AudioRoomMember', roomMemberEntity.get('objectId'))
        roomMember.set('position', position)
        let ret = await roomMember.save()
        if (ret) {
          resolve(ret)
        }
        reject(`set user position err ->${err}`)
      } catch (err) {
        reject(`set user position err ->${err}`)
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
