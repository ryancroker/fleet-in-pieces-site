"""Import only the six reviewed, exact native crew packets. No engine launch.

Usage: python scripts/import-crew-fits.py <CrewPackets.json>
Keeps historical fleet-register editions and article editors untouched.
"""
from pathlib import Path
import argparse, gzip, hashlib, json
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('receipt', type=Path)
args = parser.parse_args()
review = json.loads(args.receipt.read_text(encoding='utf-8-sig'))
packets = review['packets']
if len(packets) != 6: raise ValueError('Six reviewed crew fits required')
families = {'vf.kestrel.escort.10': ('kestrel', 'Warships'), 'vf.carrier.kite.4': ('kite', 'Carriers & aircraft')}
seen = set()
items = []
dest = ROOT/'content/crew-fits'
dest.mkdir(parents=True, exist_ok=True)
art_root = ROOT/'site/assets/fleet-register/assets'
mesh_root = ROOT/'site/assets/hull-mesh'
vertex_type = np.dtype([('position','<f4',3),('normal','<f4',3),('rgb','u1',3),('part','<i4')])
face_type = np.dtype([('count','u1'),('indices','<u4',3)])
packed_type = np.dtype([('position','<f4',3),('rgba','u1',4)])
light = np.array([-.35,-.5,1.]); light /= np.linalg.norm(light)
for packet in packets:
    source = Path(packet['folder'])
    if source.parent.resolve() != Path(review['exportRoot']).resolve(): raise ValueError('Outside reviewed export')
    for filename, expected in packet['sha256'].items():
        if Path(filename).name != filename: raise ValueError('Invalid source filename')
        if hashlib.sha256((source/filename).read_bytes()).hexdigest().upper() != expected: raise ValueError('Source changed: '+filename)
    raw_json = (source/'ship.json').read_bytes()
    n = json.loads(raw_json.decode('utf-8-sig'))
    family, category = families[n['id']]
    c, f = n['crew_accommodation'], n['fitting_contract']
    mode = c['quarters_mode']; mode_name = {1:'minimum',2:'watch',3:'reserve'}[mode]
    if (family,mode) in seen: raise ValueError('Duplicate crew fit')
    seen.add((family,mode))
    key = family+'-crew-'+mode_name
    if n['definition_hash'] != packet['definition_hash'] or n['id'] != packet['recipe_id']: raise ValueError('Packet identity mismatch')
    if c['schema'] != 'native-crew-1' or f['schema'] != 'native-fitting-1' or f['selected_recipe_revision'] != 7 or f['selected_quarters'] != mode: raise ValueError('Wrong native contract')
    if f['definition_hash'] != n['definition_hash'] or f['base_definition_hash'] != packet['base_hash'] or n['outfit_code'] != packet['outfit_code']: raise ValueError('Wrong native recipe provenance')
    for field in ['minimum','complement','bunks','spare_berths','life_support_watts']:
        if c[field] != packet[field]: raise ValueError('Reviewed crew fact mismatch: '+field)
    for slot in ['drive_limit','jet_limit']:
        if next(s for s in f['slots'] if s['key']==slot)['selected'] != 1: raise ValueError('Expected exact 75 percent propulsion caps')
    if any(f[x] for x in ['reactor_replacement_available','equipment_removal_available','additional_bays_available']): raise ValueError('Unexpected fitting authority')
    for field in ['reactor_rating_w','definition_material_mass_kg']:
        if not isinstance(n[field],(int,float)) or n[field]<0: raise ValueError('Invalid rating')
    art = {}
    for view_key,filename in [('hero','three-quarter.png'),('top','top.png'),('side','side.png'),('boarding','boarding.png')]:
        view = next(v for v in n['views'] if v['file']==filename)
        png = (source/filename).read_bytes(); sha = hashlib.sha256(png).hexdigest()
        (art_root/(sha+'.png')).write_bytes(png)
        art[view_key] = {'path':'assets/'+sha+'.png','width':view['width'],'height':view['height'], 'projection':{k:v for k,v in view.items() if k not in ['file','width','height','sha1']}}
    raw = (source/'ship.ply').read_bytes(); end=raw.index(b'end_header\n')+11; header=raw[:end].decode()
    if 'format binary_little_endian 1.0' not in header: raise ValueError('Unexpected PLY format')
    nv=int(header.split('element vertex ')[1].splitlines()[0]); nf=int(header.split('element face ')[1].splitlines()[0])
    if nv!=n['vertices'] or nf!=n['triangles'] or len(raw)!=end+nv*31+nf*13: raise ValueError('Native mesh size mismatch')
    vertices=np.frombuffer(raw,dtype=vertex_type,count=nv,offset=end)
    faces=np.frombuffer(raw,dtype=face_type,count=nf,offset=end+nv*31)
    if np.any(faces['count']!=3) or np.max(faces['indices'])>=nv: raise ValueError('Invalid triangles')
    parts=vertices['part'][faces['indices']]
    if np.any(parts!=parts[:,0:1]): raise ValueError('Cross-part triangle')
    indices=faces['indices'][np.argsort(parts[:,0],kind='stable')].reshape(-1)
    v=vertices[indices]; packed=np.empty(len(v),dtype=packed_type); packed['position']=v['position']
    rgb=v['rgb'].astype(np.float64)/255
    rgb=np.where(rgb<=.04045,rgb/12.92,((rgb+.055)/1.055)**2.4)
    rgb*=(.42+.58*np.maximum(0,v['normal']@light))[:,None]
    rgb=np.where(rgb<=.0031308,12.92*rgb,1.055*rgb**(1/2.4)-.055)
    packed['rgba'][:,:3]=np.rint(np.clip(rgb,0,1)*255).astype(np.uint8); packed['rgba'][:,3]=255
    groups={str(int(part)):{'first':int(first),'count':int(count)} for part,first,count in zip(*np.unique(v['part'],return_index=True,return_counts=True))}
    if set(map(int,groups))-set(p['index'] for p in n['parts']): raise ValueError('Unknown native part')
    binary=packed.tobytes(); compressed=gzip.compress(binary,compresslevel=6,mtime=0)
    if len(compressed)>24*1024*1024: raise ValueError('Mesh too large')
    mesh_name=hashlib.sha256(compressed).hexdigest()[:20]+'.bin.gz'
    (mesh_root/mesh_name).write_bytes(compressed)
    geometry={'recipe':n['id'],'definitionHash':n['definition_hash'],'asset':'/assets/hull-mesh/'+mesh_name,'groups':groups,'bounds':[vertices['position'].min(axis=0).tolist(),vertices['position'].max(axis=0).tolist()],'bytes':len(binary),'compressedBytes':len(compressed),'sourceSha256':packet['sha256']['ship.ply'].lower()}
    native_name=n['definition_hash'].lower()+'.json'
    (dest/native_name).write_bytes(raw_json)
    items.append({'key':key,'family':family,'mode':mode,'name':family.upper()+' / '+mode_name.title()+' quarters','category':category,'native':'crew-fits/'+native_name,'sourceSha256':packet['sha256']['ship.json'].lower(),'sourceExport':Path(review['exportRoot']).name,'sourceFiles':packet['sha256'],'art':art,'geometry':geometry})
    print(key,n['definition_hash'],c['bunks'],'bunks',len(compressed),'mesh bytes')
if seen != {(family,mode) for family in ['kestrel','kite'] for mode in [1,2,3]}: raise ValueError('Incomplete six-fit set')
(ROOT/'content/crew-fits.json').write_text(json.dumps({'schema':'crew-fits-1','receiptSha256':hashlib.sha256(args.receipt.read_bytes()).hexdigest(),'entries':items},indent=2)+'\n',encoding='utf-8')
