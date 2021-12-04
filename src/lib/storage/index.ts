import FileStorage from './FileStorage'

export default FileStorage

// TODO actually make this a general interface (FileStorage implements Storage)
export interface Storage extends FileStorage {}
