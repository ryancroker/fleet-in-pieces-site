"""Pin one actual native KITE export. Does not launch the engine or publish dossiers."""
from pathlib import Path
import argparse,hashlib,json,shutil
p=argparse.ArgumentParser();p.add_argument('folder',type=Path);a=p.parse_args()
root=Path(__file__).resolve().parents[1];source=a.folder/'ship.json'
d=json.loads(source.read_text(encoding='utf-8-sig'))
if d['id']!='vf.carrier.kite.4' or len(d['berths'])!=16:raise SystemExit('Current sixteen-berth KITE native export required')
kinds=['control','reactor','fuel_tank','magazine','drive','jet','shield','gun','feed']
machines=[]
for i,m in enumerate(d['machines']):
    if m['index']!=i:raise ValueError('Non-sequential native machine index')
    machines.append({**m,'kind_name':kinds[m['kind']]})
payload={'version':'kite-outfit-1','recipe':d['id'],'hash':d['definition_hash'],'exported':d['exported_utc'],
 'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'machines':machines,'parts':d['parts'],'berths':d['berths'],
 'projection':d['views'][0],'dimensions':d['assembled_dimensions_m'],
 'shieldCapacity':129600,'shieldRecharge':8160,
 'ratingsSource':'FoundryShip03 ShieldCapacity/ShieldRecharge; BuildCarrierVariant current combat multiplier; carrier outfitter revision 6'}
dest=root/'content/workshop-geometry';dest.mkdir(exist_ok=True)
shutil.copyfile(a.folder/'ship.ply',dest/'kite.ply')
shutil.copyfile(source,dest/'kite-native.json')
(root/'content/carrier-workshop.json').write_text(json.dumps(payload,indent=2)+'\n',encoding='utf-8')
print('Pinned',payload['recipe'],payload['hash'],len(machines),'machines; 16 berths')
