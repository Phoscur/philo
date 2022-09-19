import StillCamera from './lib/raspistill'

async function main() {
  //const preset = { roi: '0.25,0,0.7,0.7' }
  const preset = { roi: '0,0,1,1', height: '1200' }
  const camera = new StillCamera(preset)
  console.log('Shooting image with preset:', preset)
  const buffer = await camera.takeImage()
  console.log('Image shot to Buffer. Length:', buffer.length)
}
main().catch(console.error.bind(console, 'UNCAUGHT ERROR!'))
