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
        expect(ctx.body.status).to.equal(200)
        expect(ctx.body.msg).to.equal('success')
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
        // expect(ctx.body.status).to.equal(200)
        expect(ctx.body.msg).to.equal('success')
        done()
      })
  })

  it('responds to get room ban list', (done) => {
    api.get('/v1/audio/ban')
      .query({
        access_token: token,
        roomId: `59f8435dee920a00457e4fb0`
      })
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, ctx) => {
        expect(ctx.body.status).to.equal(200)
        expect(ctx.body.msg).to.equal('success')
        done()
      })
  })

  it('responds to get blockList', (done) => {
    api.get('/v1/audio/blockList')
      .query({
        access_token: token,
        roomId: `59f8435dee920a00457e4fb0`
      })
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, ctx) => {
        expect(ctx.body.status).to.equal(200)
        expect(ctx.body.msg).to.equal('success')
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
        expect(ctx.body.status).to.equal(200)
        expect(ctx.body.msg).to.equal('get user room success')
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
        expect(ctx.body.status).to.equal(200)
        expect(ctx.body.msg).to.equal('success')
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
        expect(ctx.body.status).to.equal(200)
        expect(ctx.body.msg).to.equal('user leave success')
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
        expect(ctx.body.status).to.equal(200)
        expect(ctx.body.msg).to.equal(`create room ${ctx.body.data.objectId} success`)
        done()
      })
  })

  it('responds to update roomTitle', (done) => {
    api.put('/v1/audio/roomTitle')
      .send({
        access_token: token,
        roomId: '59f8435dee920a00457e4fb0',
        title: `backEnd test again`
      })
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, ctx) => {
        expect(ctx.body.status).to.equal(1001)
        expect(ctx.body.msg).to.equal('只有房主才能修改标题')
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
