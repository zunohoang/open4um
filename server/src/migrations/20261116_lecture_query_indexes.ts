import { LECTURE_QUERY_INDEXES } from '@/models/lecture.model'
import type { Migration } from '@/migrations/types'

const migration: Migration = {
  id: '20261116_lecture_query_indexes',
  async up({ db }) {
    const collection = db.collection('lectures')
    for (const { fields, name } of LECTURE_QUERY_INDEXES) {
      await collection.createIndex(fields, { name })
    }
  },
  async down({ db }) {
    const collection = db.collection('lectures')
    for (const { name } of LECTURE_QUERY_INDEXES) {
      try {
        await collection.dropIndex(name)
      } catch (error) {
        if ((error as { code?: number }).code !== 27) throw error
      }
    }
  }
}

export default migration
