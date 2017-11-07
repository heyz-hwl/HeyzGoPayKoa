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

describe('test hok', async() => {
  let api;
	let token;
  beforeEach(async() => {
		api = request(server)
		token = await createToken()
  })

  it('responds to /v1/hero', (done) => {
    api.get('/v1/hero')
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, ctx) => {
        expect(ctx.body.status).to.equal(200)				
        expect(ctx.body.msg).to.equal('success')
        done()
      })
  })

  it('responds to /v1/hokInfo', (done) => {
    api.post('/v1/hokInfo')
      .send({
				access_token: token,
				ID: `back end test`,
				type: `1`,
				position: ['backEnd', 'test'],
				hero: ['backEnd', 'test'],
				default: false
      })
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, ctx) => {
				expect(ctx.body.status).to.equal(200)
        expect(ctx.body.msg).to.equal('success')
        done()
      })
	})
	
	it('responds to /v1/hokInfoDelete', (done) => {
		api.delete('/v1/hokInfoDelete')
			.send({
				access_token: token,
				HOKId: '5a018062128fe100689ec308'
			})
			.expect('Content-Type', /json/)
      .expect(200)
      .end((err, ctx) => {
				expect(ctx.body.status).to.equal(200)
        expect(ctx.body.msg).to.equal('delete hokInfo success')
        done()
      })
	})

	it('responds to /v1/hokInfoByUserId', (done) => {
		api.get('/v1/hokInfoByUserId')
			.query({
				access_token: token,
				userId: '59929e68a22b9d0057108c6f'
			})
			.expect('Content-Type', /json/)
      .expect(200)
      .end((err, ctx) => {
				expect(ctx.body.status).to.equal(200)
        expect(ctx.body.msg).to.equal('success')
        done()
      })
	})

	it('responds to /v1/hokInfoByHOKId', (done) => {
		api.get('/v1/hokInfoByHOKId')
			.query({
				access_token: token,
				HOKId: `59f1ac609545040037a01157`
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
