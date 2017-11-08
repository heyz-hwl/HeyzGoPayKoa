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

describe('test user', async() => {
  let api;
  let token;
  beforeEach(async() => {
    api = request(server)
    token = await createToken()
  })

  it('responds to add blockList', (done) => {
    api.post('/v1/user/blockList')
      .send({
        access_token: token,
        userId: '59b7b2348d6d81005565a72b'
      })
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, ctx) => {
        expect(ctx.body.status).to.equal(200)
        expect(ctx.body.msg).to.equal('success')
        done()
      })
  })

  it('responds to delete blockList', (done) => {
    api.delete('/v1/user/blockList')
      .send({
        access_token: token,
        userId: '59b7b2348d6d81005565a72b'
      })
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, ctx) => {
        expect(ctx.body.status).to.equal(200)
        expect(ctx.body.msg).to.equal('success')
        done()
      })
  })

  it('responds to unfollow', (done) => {
    api.get('/v1/user/unfollow')
      .query({
        access_token: token,
        fansId: '59b7b2348d6d81005565a72b'
      })
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, ctx) => {
        expect(ctx.body.status).to.equal(403)
        expect(ctx.body.msg).to.equal('不是粉丝')
        done()
      })
  })

  it('responds to get chatting friend', (done) => {
    api.get('/v1/user/chattingFriend')
      .query({
        access_token: token,
      })
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, ctx) => {
        expect(ctx.body.status).to.equal(200)
        expect(ctx.body.msg).to.equal('success')
        done()
      })
  })

  it('responds to get wxUid to userName', (done) => {
    api.get('/v1/userName')
      .query({
        access_token: token,
        wxUid: '123'
      })
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, ctx) => {
        expect(ctx.body.status).to.equal(201)
        expect(ctx.body.msg).to.equal('new one')
        done()
      })
  })

  it('responds to get user info', (done) => {
    api.get('/v1/user')
      .query({
        access_token: token,
        userId: `59f1b01a67f35600445106eb`
      })
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, ctx) => {
        expect(ctx.body.status).to.equal(200)
        expect(ctx.body.msg).to.equal('success')
        done()
      })
  })
//   it('responds to update user info', (done) => {
//     api.put('/v1/user')
//       .send({
//         access_token: token,
//       })
//       .expect('Content-Type', /json/)
//       .expect(200)
//       .end((err, ctx) => {
//         expect(ctx.body.status).to.equal(200)
//         expect(ctx.body.msg).to.equal('success')
//         done()
//       })
//   })

  it('responds to get fans and follow nub', (done) => {
    api.get('/v1/user/follow/len')
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

  it('responds to get followee', (done) => {
    api.get('/v1/user/followee')
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

  it('responds to get fans', (done) => {
    api.get('/v1/user/follower')
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
