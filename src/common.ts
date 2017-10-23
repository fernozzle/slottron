export const primaryKey = '_id'

export interface SlottronModels {
  'items/': {project: string, path: string, isReal: boolean, group: string, _id: any},
  'projects/': {createdAt: string, path: string, _id: string}
}