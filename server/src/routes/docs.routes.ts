import { Router } from 'express'
import swaggerUi from 'swagger-ui-express'
import document from '../docs/swagger.json'

export const docsRouter = Router()
docsRouter.get('/api-docs/openapi.json', (_req, res) => res.json(document))
docsRouter.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(document, {
    customSiteTitle: 'ABSlider API Explorer',
    swaggerOptions: {
      validatorUrl: null,
      persistAuthorization: false,
      displayRequestDuration: true
    }
  })
)
docsRouter.get(['/docs', '/swagger'], (_req, res) => res.redirect('/api-docs/'))
