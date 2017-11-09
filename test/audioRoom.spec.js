const request = require('supertest')
const {
  createToken
} = require('../lib/jwt')
const {
  expect
} = require('chai')
const server = require('../app')
const AV = require('leancloud-storage')
const config = require('../lib/config')
let roomId;

describe('test audioRoom', async() => {
  let api;
  let token;
  beforeEach(async() => {
    api = request(server)
    token = await createToken()
  })

  it('responds to user join in room', (done) => {
    api.post('/v1/audio/user')
      .send({
        access_token: token,
        roomId: `59f8435dee920a00457e4fb0`
      })
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, ctx) => {
        expect(ctx.body.msg).to.equal('success')
        expect(ctx.body.status).to.equal(200)
        done()
      })
  })

  it('responds to get background pic url', (done) => {
    api.get('/v1/audio/bgPic')
      .query({
        access_token: token
      })
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, ctx) => {
        expect(ctx.body.msg).to.equal('success')
        expect(ctx.body.status).to.equal(200)
        done()
      })
  })

  it('responds to find user room', (done) => {
    api.get('/v1/audio/userRoom')
      .query({
        access_token: token
      })
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, ctx) => {
        expect(ctx.body.msg).to.equal('get user room success')
        expect(ctx.body.status).to.equal(200)
        done()
      })
  })

  it('responds to get userInfo', (done) => {
    api.get('/v1/audio/userInfo')
      .query({
        access_token: token,
        roomId: '59f8435dee920a00457e4fb0'
      })
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, ctx) => {
        expect(ctx.body.msg).to.equal('success')
        expect(ctx.body.status).to.equal(200)
        done()
      })
  })

  it('responds to userLeave room', (done) => {
    api.post('/v1/audio/userLeave')
      .send({
        access_token: token,
        roomId: `59f8435dee920a00457e4fb0`
      })
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, ctx) => {
        expect(ctx.body.msg).to.equal('user leave success')
        expect(ctx.body.status).to.equal(200)
        done()
      })
  })

  it('responds to create room', (done) => {
    api.post('/v1/audio/room')
      .send({
        access_token: token,
        title: 'backEnd test'
      })
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, ctx) => {
        roomId = ctx.body.data.objectId
        console.log(`roomId is ${roomId}`)
        expect(ctx.body.msg).to.equal(`create room ${ctx.body.data.objectId} success`)
        expect(ctx.body.status).to.equal(200)
        done()
      })
  })

  it('responds to update roomTitle', (done) => {
    api.put('/v1/audio/roomTitle')
      .send({
        access_token: token,
        roomId: roomId,
        title: `backEnd test again`
      })
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, ctx) => {
        expect(ctx.body.msg).to.equal('success')
        expect(ctx.body.status).to.equal(200)
        done()
      })
  })

  it('responds to select pic', (done) => {
    api.put('/v1/audio/selectPic')
      .send({
        access_token: token,
        roomId: roomId,
        coverId: '5a041363128fe10068a23844',
        iconId: '5a041467a22b9d00629c854b'
      })
      .expect(200)
      .end((err, ctx) => {
        expect(ctx.body.msg).to.equal('success')
        expect(ctx.body.status).to.equal(200)
        done()
      })
  })

  it('responds to add user to room ban list', (done) => {
    api.post('/v1/audio/ban')
      .send({
        access_token: token,
        roomId: roomId,
        userId: '59f68e0ffe88c200618e2931'
      })
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, ctx) => {
        expect(ctx.body.msg).to.equal('success')
        expect(ctx.body.status).to.equal(200)
        done()
      })
  })

  it('responds to get room ban list', (done) => {
    api.get('/v1/audio/ban')
      .query({
        access_token: token,
        roomId: roomId
      })
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, ctx) => {
        expect(ctx.body.msg).to.equal('success')
        expect(ctx.body.status).to.equal(200)
        done()
      })
  })

  it('responds to delete user from room ban list', (done) => {
    api.delete('/v1/audio/ban')
      .send({
        access_token: token,
        roomId: roomId,
        userId: '59f68e0ffe88c200618e2931'
      })
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, ctx) => {
        expect(ctx.body.msg).to.equal('success')
        expect(ctx.body.status).to.equal(200)
        done()
      })
  })

  it('responds to add user to room blocklist', (done) => {
    api.post('/v1/audio/blocklist')
      .send({
        access_token: token,
        roomId: roomId,
        userId: '59f68e0ffe88c200618e2931'
      })
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, ctx) => {
        expect(ctx.body.msg).to.equal('success')
        expect(ctx.body.status).to.equal(200)
        done()
      })
  })

  it('responds to get blockList', (done) => {
    api.get('/v1/audio/blockList')
      .query({
        access_token: token,
        roomId: roomId
      })
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, ctx) => {
        expect(ctx.body.msg).to.equal('success')
        expect(ctx.body.status).to.equal(200)
        done()
      })
  })

  it('responds to blockList user add room fail', async(done) => {
    let newToken = await createToken(`59f68e0ffe88c200618e2931`)
    api.post('/v1/audio/user')
      .send({
        access_token: newToken,
        roomId: roomId
      })
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, ctx) => {
        expect(ctx.body.msg).to.equal('你被房主禁止进入房间')
        expect(ctx.body.status).to.equal(403)
        done()
      })
  })

  it('responds to delete user from room blocklist', (done) => {
    api.delete('/v1/audio/blocklist')
      .send({
        access_token: token,
        roomId: roomId,
        userId: '59f68e0ffe88c200618e2931'
      })
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, ctx) => {
        expect(ctx.body.msg).to.equal('success')
        expect(ctx.body.status).to.equal(200)
        done()
      })
  })

  it('responds to userLeave room', (done) => {
    api.post('/v1/audio/userLeave')
      .send({
        access_token: token,
        roomId: roomId
      })
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, ctx) => {
        expect(ctx.body.msg).to.equal('房间已经没有用户, 房间被删除')
        expect(ctx.body.status).to.equal(201)
        done()
      })
  })

  it('responds to get all rooms', (done) => {
    api.get('/v1/audio/rooms')
      .query({
        access_token: token
      })
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, ctx) => {
        expect(ctx.body.status).to.equal(200)
        expect(ctx.body.msg).to.equal('success')
        done()
      })
  })

})
