module.exports = function stubLoader() {
  return 'export const dynamic = "force-dynamic"; export default function Stub() { return null; }';
};
