import express from 'express'
import request from 'supertest'
import document from '../../../src/docs/swagger.json'
import { actualOperations, buildOpenApi } from '../../../src/docs/buildOpenApi'
import { docsRouter } from '../../../src/routes/docs.routes'

const app = express().use(docsRouter)

describe('API documentation accuracy', () => {
  it('matches every currently implemented operation and has no phantom routes', () => {
    const operations = Object.entries(document.paths).flatMap(([path, item]) =>
      Object.keys(item)
        .filter((method) => ['get', 'post', 'patch', 'delete'].includes(method))
        .map((method) => `${method} ${path}`)
    )
    expect(operations.sort()).toEqual(actualOperations())
    expect(document).toEqual(buildOpenApi())
  })
  it('uses same-origin requests and the actual response envelope', () => {
    expect(document.servers).toEqual([
      {
        url: '/api/v1',
        description: 'This backend origin (local or deployed)'
      }
    ])
    const error = document.components.schemas.ErrorResponse
    expect(error.properties.success).toEqual({
      type: 'boolean',
      enum: [false]
    })
    expect(error.properties).not.toHaveProperty('status')
    expect(document.paths['/auth/login'].post.security).toEqual([])
    expect(document.paths['/admin/credit-config'].patch.security).toEqual([
      { BearerAuth: [] }
    ])
  })
  it('serves the exact JSON and local Swagger explorer without application dependencies', async () => {
    const json = await request(app).get('/api-docs/openapi.json').expect(200)
    expect(json.body).toEqual(document)
    const html = await request(app).get('/api-docs/').expect(200)
    expect(html.text).toContain('swagger-ui')
    const init = await request(app)
      .get('/api-docs/swagger-ui-init.js')
      .expect(200)
    expect(init.text).toContain('"persistAuthorization": false')
    expect(init.text).toContain('"validatorUrl": null')
    await request(app).get('/docs').expect('Location', '/api-docs/')
  })
})
