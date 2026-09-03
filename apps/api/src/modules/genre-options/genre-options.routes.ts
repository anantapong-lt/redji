import { Elysia } from 'elysia'
import { getGenreOptions } from './genre-options.service'

export const genreOptionsRoutes = new Elysia().get('/genres-options', async () => ({
  options: await getGenreOptions(),
}))
