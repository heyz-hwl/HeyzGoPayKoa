const request = require('supertest')
const { expect } = require('chai')
const server = require('../app')
const AV = require('leancloud-storage')
const config = require('../lib/config')

describe('test token sign', async() => {
  let api;
	beforeEach(() => {
		api = request(server)
	})

	it('responds to /v1/sign', (done) => {
		api.post('/v1/sign')
		.send({userId:'59929e68a22b9d0057108c6f'})
		.expect('Content-Type', /json/)
		.expect(200)
		.end((err, ctx) => {
			expect(ctx.body.status).to.equal(200)
			expect(ctx.body.msg).to.equal('Successful!')
			done()
		})
	})
})
