"""Build lazy, part-addressable meshes from exact published native exports.

No engine launch. No synthesized hull geometry. Requires numpy; run explicitly
when the pinned fleet directory changes. prepare-site only consumes the receipt.
"""
from pathlib import Path
import argparse, gzip, hashlib, json
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--exports', type=Path, required=True)
args = parser.parse_args()
register = json.loads((ROOT/'content/fleet-register.json').read_text())
output = ROOT/'site/assets/hull-mesh'
output.mkdir(parents=True, exist_ok=True)
index = {}
for file in sorted(args.exports.glob('*/*/ship.json')):
    index.setdefault(file.parent.name, []).append(file)
receipt = {}
light = np.array([-.35, -.5, 1.]); light /= np.linalg.norm(light)
vertex_type = np.dtype([('position','<f4',3),('normal','<f4',3),('rgb','u1',3),('part','<i4')])
face_type = np.dtype([('count','u1'),('indices','<u4',3)])
packed_type = np.dtype([('position','<f4',3),('rgba','u1',4)])
for key, ship in register['ships'].items():
    edition = next(x for x in ship['configurations'] if x['revision_id']==ship['current_revision'])
    dossier = json.loads((ROOT/'site/assets/fleet-register'/edition['path']).read_text())
    identity = edition['recipe_id']+'_'+edition['definition_hash']
    candidates = index.get(identity, [])
    if not candidates: raise RuntimeError('No exact native mesh: '+identity)
    source = candidates[0]
    native = json.loads(source.read_text(encoding='utf-8-sig'))
    if native['id']!=edition['recipe_id'] or native['definition_hash']!=edition['definition_hash']:
        raise RuntimeError('Native identity mismatch: '+key)
    raw = source.with_name('ship.ply').read_bytes()
    end = raw.index(b'end_header\n')+11
    header = raw[:end].decode()
    if 'format binary_little_endian 1.0' not in header: raise RuntimeError('PLY format')
    nv = int(header.split('element vertex ')[1].splitlines()[0])
    nf = int(header.split('element face ')[1].splitlines()[0])
    if nv!=native['vertices'] or nf!=native['triangles'] or len(raw)!=end+nv*31+nf*13:
        raise RuntimeError('Mesh count mismatch: '+key)
    if nv!=dossier['geometry_counts']['vertices'] or nf!=dossier['geometry_counts']['triangles']:
        raise RuntimeError('Published edition geometry mismatch: '+key)
    vertices = np.frombuffer(raw,dtype=vertex_type,count=nv,offset=end)
    faces = np.frombuffer(raw,dtype=face_type,count=nf,offset=end+nv*31)
    if np.any(faces['count']!=3) or np.max(faces['indices'])>=nv: raise RuntimeError('Invalid faces')
    indices = faces['indices'].reshape(-1)
    parts = vertices['part'][faces['indices']]
    if np.any(parts!=parts[:,0:1]): raise RuntimeError('Cross-part triangle')
    order = np.argsort(parts[:,0],kind='stable')
    indices = faces['indices'][order].reshape(-1)
    v = vertices[indices]
    packed = np.empty(len(v),dtype=packed_type)
    packed['position'] = v['position']
    rgb = v['rgb'].astype(np.float64)/255
    rgb = np.where(rgb<=.04045,rgb/12.92,((rgb+.055)/1.055)**2.4)
    rgb *= (.42+.58*np.maximum(0,v['normal']@light))[:,None]
    rgb = np.where(rgb<=.0031308,12.92*rgb,1.055*rgb**(1/2.4)-.055)
    packed['rgba'][:,:3] = np.rint(np.clip(rgb,0,1)*255).astype(np.uint8)
    packed['rgba'][:,3] = 255
    groups = {}
    for part, first, count in zip(*np.unique(v['part'],return_index=True,return_counts=True)):
        if not any(p['index']==part for p in dossier['parts']): raise RuntimeError('Unknown part')
        groups[str(int(part))] = {'first':int(first),'count':int(count)}
    binary = packed.tobytes()
    compressed = gzip.compress(binary,compresslevel=6,mtime=0)
    digest = hashlib.sha256(compressed).hexdigest()[:12]
    filename = key+'.'+digest+'.bin.gz'
    if len(compressed)>24*1024*1024: raise RuntimeError('Asset too large: '+key)
    (output/filename).write_bytes(compressed)
    bounds = [vertices['position'].min(axis=0).tolist(),vertices['position'].max(axis=0).tolist()]
    receipt[key] = {'recipe':edition['recipe_id'],'definitionHash':edition['definition_hash'],
                    'asset':'/assets/hull-mesh/'+filename,'groups':groups,'bounds':bounds,
                    'bytes':len(binary),'compressedBytes':len(compressed),
                    'sourceSha256':hashlib.sha256(raw).hexdigest()}
    print(key+': '+str(len(compressed))+' bytes',flush=True)
(ROOT/'content/fleet-geometry.json').write_text(json.dumps(receipt,separators=(',',':'))+'\n')
print('Total: '+str(len(receipt))+' hulls / '+str(sum(x['compressedBytes'] for x in receipt.values()))+' bytes')
