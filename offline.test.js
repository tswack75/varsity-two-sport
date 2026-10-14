import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

test('service worker precaches the active build and serves it offline',async()=>{
  const listeners={},files=new Map(),cache={addAll:async assets=>{for(const asset of assets)files.set(asset,{asset})},put:async()=>{},match:async request=>files.get(request.url)||files.get(request)};
  const caches={open:async()=>cache,match:async request=>cache.match(request),keys:async()=>['varsity-shell-v6'],delete:async()=>true};
  const self={addEventListener:(type,callback)=>listeners[type]=callback,skipWaiting:async()=>{},clients:{claim:async()=>{}}};
  runInNewContext(readFileSync(new URL('./sw.js',import.meta.url),'utf8'),{self,caches,fetch:async()=>{throw Error('Offline')},URL,location:{origin:'http://localhost:4173'}});
  let install;listeners.install({waitUntil:promise=>install=promise});await install;
  for(const asset of ['./index.html','./app-simple.js','./tracker.js','./progression-simple.js','./strength-ui.js'])assert.ok(files.has(asset));
  assert.match(readFileSync(new URL('./app-simple.js',import.meta.url),'utf8'),/serviceWorker\.register\('\.\/sw\.js'\)/);
  let response;listeners.fetch({request:{method:'GET',url:'http://localhost:4173/index.html'},respondWith:promise=>response=promise});
  assert.deepEqual(await response,{asset:'./index.html'});
});
