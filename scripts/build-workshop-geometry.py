"""Convert a pinned native PLY to part-addressable web geometry (no game launch).

Stock parts keep their native surfaces. Alternate articles translate the public
construction operations in FleetVoxelOutfitter.cpp/MixedGuns and
FleetVoxelCustomization.cpp/Emitter. This is a visual adapter, not BuildOutfit.
Run explicitly when the pinned geometry changes; output is committed for Pages.
"""
from pathlib import Path
import hashlib, json, math, struct

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'content/workshop-geometry'
palette = {3:(.19,.225,.26),4:(.30,.345,.38),9:(.019,.024,.031),13:(.08,.67,.92),16:(.045,.065,.084),17:(.36,.42,.46),18:(.085,.108,.123),19:(.34,.39,.40)}
light = (-.35,-.5,1)
light = tuple(x / math.sqrt(sum(v*v for v in light)) for x in light)
def gamma(x): return round(255*(12.92*x if x<=.0031308 else 1.055*x**(1/2.4)-.055))
def linear(x):
    x/=255
    return x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4
def color(rgb,n):
    shade=.42+.58*max(0,sum(a*b for a,b in zip(n,light)))
    return tuple(gamma(min(1,max(0,v*shade))) for v in rgb)

blob=(SOURCE/'kestrel.ply').read_bytes()
end=blob.index(b'end_header\n')+11
head=blob[:end].decode()
nv=int(head.split('element vertex ')[1].splitlines()[0])
nf=int(head.split('element face ')[1].splitlines()[0])
verts=[struct.unpack_from('<6f3Bi',blob,end+i*31) for i in range(nv)]
groups={str(i):[] for i in range(15)}
for i in range(nf):
    count,a,b,c=struct.unpack_from('<B3I',blob,end+nv*31+i*13)
    assert count==3 and len({verts[j][-1] for j in (a,b,c)})==1
    dest=groups[str(verts[a][-1])]
    for j in (a,b,c):
        v=verts[j]; dest.append((*v[:3],*color(tuple(linear(x) for x in v[6:9]),v[3:6])))

# Small article construction uses half-metre cells and exact box/plane bounds.
# Clip only the partial cells; omit shared voxel faces. Native AO is retained on
# stock parts; alternate articles use the same authored palette and lighting.
dirs=[(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)]
def cube(x,y,z):
    return [([(x+1,y,z),(x+1,y+1,z),(x+1,y+1,z+1),(x+1,y,z+1)],dirs[0]),
            ([(x,y,z),(x,y,z+1),(x,y+1,z+1),(x,y+1,z)],dirs[1]),
            ([(x,y+1,z),(x,y+1,z+1),(x+1,y+1,z+1),(x+1,y+1,z)],dirs[2]),
            ([(x,y,z),(x+1,y,z),(x+1,y,z+1),(x,y,z+1)],dirs[3]),
            ([(x,y,z+1),(x+1,y,z+1),(x+1,y+1,z+1),(x,y+1,z+1)],dirs[4]),
            ([(x,y,z),(x,y+1,z),(x+1,y+1,z),(x+1,y,z)],dirs[5])]
def clip(faces,n,d):
    out=[];cut=[]
    for poly,normal in faces:
        q=[]
        for a,b in zip(poly,poly[1:]+poly[:1]):
            da=sum(x*y for x,y in zip(a,n))-d;db=sum(x*y for x,y in zip(b,n))-d
            if da<=1e-8:q.append(a)
            if (da<0<db) or (db<0<da):
                p=tuple(x+(y-x)*da/(da-db) for x,y in zip(a,b));q.append(p);cut.append(p)
        if len(q)>=3:out.append((q,normal))
    cut=list(dict.fromkeys(tuple(round(v,8) for v in p) for p in cut))
    if len(cut)>2:
        length=math.sqrt(sum(v*v for v in n));normal=tuple(v/length for v in n)
        centre=tuple(sum(p[j] for p in cut)/len(cut) for j in range(3))
        u=tuple(cut[0][j]-centre[j] for j in range(3))
        v=(normal[1]*u[2]-normal[2]*u[1],normal[2]*u[0]-normal[0]*u[2],normal[0]*u[1]-normal[1]*u[0])
        cut.sort(key=lambda p:math.atan2(sum((p[j]-centre[j])*v[j] for j in range(3)),sum((p[j]-centre[j])*u[j] for j in range(3))))
        out.append((cut,normal))
    return out
class Article:
    def __init__(self):self.cells={}
    def box(self,lo,hi,finish,planes=(),paint=False):
        for x in range(lo[0],hi[0]):
            for y in range(lo[1],hi[1]):
                for z in range(lo[2],hi[2]):
                    key=(x,y,z)
                    if paint:
                        if key in self.cells:self.cells[key]=(finish,self.cells[key][1])
                        continue
                    if not finish:self.cells.pop(key,None);continue
                    faces=cube(x,y,z)
                    for n,d in planes:faces=clip(faces,n,d)
                    if faces:self.cells[key]=(finish,faces)
    def mesh(self):
        # Cancel only identical shared faces, preserving sloped partial-cell gaps.
        faces={}
        for finish,polys in self.cells.values():
            for poly,n in polys:
                key=tuple(sorted(tuple(round(v,6) for v in p) for p in poly))
                if key in faces:faces.pop(key)
                else:faces[key]=(poly,n,finish)
        vertices=[]
        for poly,n,finish in faces.values():
            rgb=color(palette[finish],n)
            for i in range(1,len(poly)-1):
                for p in (poly[0],poly[i],poly[i+1]):vertices.append((*[v*.5 for v in p],*rgb))
        return vertices

for family in ('reservoir','cascade','facet'):
    a=Article();a.box((-6,-4,0),(6,4,2),9);a.box((-1,-1,2),(1,1,6),13)
    if family=='reservoir':
        a.box((-4,-3,2),(4,3,5),19)
        for side in (-1,1):
            a.box((-3,-4 if side<0 else 2,2),(3,-2 if side<0 else 4,8),9)
            a.box((-2,-4 if side<0 else 2,8),(2,-2 if side<0 else 4,14),13)
    elif family=='cascade':
        a.box((-5,-4,2),(5,4,4),19)
        for x in (-4,0,4):a.box((x-1,-3,4),(x+1,3,8),13)
    else:
        a.box((-4,-3,2),(4,3,9),13,(((-1,0,1),5),))
        a.box((3,-3,2),(5,3,8),9);a.box((2,-4,8),(5,4,9),19)
    groups[family]=a.mesh()
for small in (False,True):
    for family in ('rapid','lance'):
        tip=(10 if small else 18) if family=='rapid' else (20 if small else 32)
        a=Article();sections=[(0,2,-2,2),(5,2,-2,2),(8,1 if small else 2,-1 if small else -2,1 if small else 2),(tip,1 if small else 2,-1 if small else -2,1 if small else 2)]
        for l,r in zip(sections,sections[1:]):
            dx=r[0]-l[0];sw=(r[1]-l[1])/dx;sb=(r[2]-l[2])/dx;st=(r[3]-l[3])/dx
            w=math.ceil(max(l[1],r[1]))
            a.box((l[0],-w,math.floor(min(l[2],r[2]))),(r[0],w,math.ceil(max(l[3],r[3]))),3,(((-sw,1,0),l[1]-sw*l[0]),((-sw,-1,0),l[1]-sw*l[0]),((-st,0,1),l[3]-st*l[0]),((sb,0,-1),-l[2]+sb*l[0])))
        a.box((1,-2,-1),(6,2,2),16)
        a.box((5 if small else 7,-2 if small else -3,-2),(8 if small else 11,2 if small else 3,2),17 if family=='rapid' else 18)
        a.box((8 if small else 11,-2,-2),(tip-2,2,2),3 if family=='rapid' else 16,paint=True)
        a.box((tip-2,-2,-2),(tip-1,2,2),4,paint=True)
        a.box((6,0 if small else -1,0 if small else -1),(tip,1,1),0)
        groups[('aft-' if small else 'fore-')+family]=a.mesh()

out=bytearray();meta={}
for key,vs in groups.items():
    meta[key]={'first':len(out)//16,'count':len(vs)}
    for x,y,z,r,g,b in vs:out.extend(struct.pack('<3f4B',x,y,z,r,g,b,255))
digest=hashlib.sha256(out).hexdigest()[:12]
asset='workshop-mesh.'+digest+'.bin'
(ROOT/'site/assets'/asset).write_bytes(out)
payload={'asset':'/assets/'+asset,'groups':meta,'sourceSha256':hashlib.sha256(blob).hexdigest()}
(ROOT/'site/outfit-geometry.js').write_text('// Generated native parts and source-derived alternate articles. See scripts/build-workshop-geometry.py.\nwindow.FleetOutfitGeometry = '+json.dumps(payload,separators=(',',':'))+';\n',encoding='utf-8')
print(f'{asset}: {len(out):,} bytes, {len(meta)} independently drawn parts')
