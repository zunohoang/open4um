import type { Migration } from './types'
import { externalizeImages } from '@/utils/lectureImages'

const migration: Migration = {
  id: '20261121_externalize_embedded_images',
  async up({ db }) {
    const lectures = db.collection('lectures')
    for await (const doc of lectures.find(
      {},
      {
        projection: { userId: 1, slides: 1, aiChatHistory: 1, updatedAt: 1 },
        batchSize: 1
      }
    )) {
      if (
        await externalizeImages(
          String(doc.userId),
          [doc.slides, doc.aiChatHistory],
          true
        )
      ) {
        const result = await lectures.updateOne(
          { _id: doc._id, updatedAt: doc.updatedAt },
          {
            $set: {
              slides: doc.slides,
              ...(doc.aiChatHistory ? { aiChatHistory: doc.aiChatHistory } : {})
            },
            $inc: { revision: 1 }
          }
        )
        if (!result.matchedCount)
          throw new Error(
            'Bài giảng thay đổi trong khi chuyển ảnh. Hãy chạy lại migration.'
          )
      }
    }
    const users = db.collection('users')
    for await (const user of users.find(
      { avatar: /^data:image\// },
      { projection: { avatar: 1 }, batchSize: 1 }
    )) {
      const image = { type: 'image', content: user.avatar }
      if (await externalizeImages(String(user._id), [image], true)) {
        await users.updateOne(
          { _id: user._id, avatar: user.avatar },
          { $set: { avatar: image.content } }
        )
      }
    }
  }
}
export default migration
