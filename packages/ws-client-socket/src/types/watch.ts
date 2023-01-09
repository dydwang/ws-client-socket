type typeCall = (news: any, olds: any) => void
interface WatchInter {
  target: object
  key: string
  init: (call: typeCall) => void
  clear: () => void
}
export { typeCall, WatchInter }
