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

describe('test audioChannel', async() => {
  let api;
  let token;
  beforeEach(async() => {
    api = request(server)
    token = await createToken()
  })

  it('responds to apply Sequence', (done) => {
    api.post('/v1/audio/applySequence')
      .send({
        access_token: token,
        channelId:1
      })
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, ctx) => {
        expect(ctx.body.status).to.equal(200)
        expect(ctx.body.msg).to.equal('申请成功')
        done()
      })
  })

  it('responds to get user sequence order', (done) => {
    api.get('/v1/audio/userSequence')
      .query({
        access_token: token,
      })
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, ctx) => {
        expect(ctx.body.status).to.equal(200)
        expect(ctx.body.msg).to.equal(`你排在第${ctx.body.data[0].order_nub}位`)
        done()
      })
  })

  it('responds to get Top3 sequence user', (done) => {
    api.get('/v1/audio/Sequence')
      .query({
        access_token: token
      })
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, ctx) => {
        expect(ctx.body.status).to.equal(200)
        expect(ctx.body.msg).to.equal('get Sequence success')
        done()
      })
  })

  it('responds to changeSequence', (done) => {
    api.get('/v1/audio/changeSequence')
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
