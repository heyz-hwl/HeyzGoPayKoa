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

describe('test draw', async() => {
  let api
  let token 
  beforeEach(async() => {
    api = request(server)
    token = await createToken()
  })

  it('responds to draw', (done) => {
    api.get('/v1/draw')
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

  it('responds to kefu', (done) => {
    api.get('/v1/draw/kefu')
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

  it('responds to get skinURL', (done) => {
    api.get('/v1/draw/skinURL')
      .query({
        access_token: token,
        type: 34
      })
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, ctx) => {
        expect(ctx.body.status).to.equal(200)
        expect(ctx.body.msg).to.equal('success')
        done()
      })
  })

  it('responds to select Skin ', (done) => {
    api.put('/v1/draw/selectSkin')
      .send({
        access_token: token,
        drawRecordId: `59fe69a09545040061e6d1a3`,
        skinName: `backEnd-test`,
        skinId:`59eeed70954504006788f8af`,
        prizeWinnerID: `backEnd-test`,
        isWechat:true
      })
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, ctx) => {
        expect(ctx.body.status).to.equal(403)
        expect(ctx.body.msg).to.equal('已经选择了皮肤,如需修改请联系客服')
        done()
      })
  })

  it('responds to will Delivery', (done) => {
    api.get('/v1/draw/willDelivery')
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

  it('responds to switch delivery', (done) => {
    api.put('/v1/draw/delivery')
      .send({
        access_token: token,
        drawRecordId: `59fe69a09545040061e6d1a3`
      })
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, ctx) => {
        expect(ctx.body.status).to.equal(200)
        expect(ctx.body.msg).to.equal('success to true')
        done()
      })
  })

  it('responds to get user draw record', (done) => {
    api.get('/v1/draw/record')
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
