const request = require('supertest')
const {
  expect
} = require('chai')
const {
  createToken
} = require('../lib/jwt')
const server = require('../app')
const AV = require('leancloud-storage')
const config = require('../lib/config')

describe('test token sign', async() => {
  let api;
  let token;
  beforeEach(async() => {
    api = request(server)
    token = await createToken()
  })

  it('responds to sign', (done) => {
    api.get('/v1/sign')
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

  it('responds to sign/status', (done) => {
    api.get('/v1/sign/status')
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
