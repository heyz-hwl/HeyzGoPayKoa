const request = require('supertest')
const {
  expect
} = require('chai')
const moment = require('moment')
const server = require('../app')
const AV = require('leancloud-storage')
const config = require('../lib/config')

describe('test CompeteRegister', async() => {
  let api;
  beforeEach(async() => {
    api = request(server)
  })

  it('response to register', (done) => {
    api.post('/v1/register')
      .send({
        phone: `13088888888`,
        nickName: `王者荣耀`,
        gender: 1,
        type: 1,
        isWechat: true,
        level: `最强王者100星`,
        wechat: `123123123`
      })
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, ctx) => {
        expect(ctx.body.msg).to.equal('success')
        expect(ctx.body.status).to.equal(200)
        done()
      })
  })

  it('response to get one week register', (done) => {
    api.get('/v1/register')
      .query({
        time: `1510568028`
      })
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, ctx) => {
        expect(ctx.body.msg).to.equal('success')
        expect(ctx.body.status).to.equal(200)
        done()
      })
  })
})
