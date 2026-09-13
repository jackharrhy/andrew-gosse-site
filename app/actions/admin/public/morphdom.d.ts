// Use the package's browser ESM build with its upstream type contract.
declare module "morphdom/dist/morphdom-esm.js" {
  const morphdom: typeof import("morphdom").default;
  export default morphdom;
}
