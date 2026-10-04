-- Add briefing registry entries only. Existing ideas, votes, replies, profiles and IDs are untouched.

-- Source: content/systems.json. No schema rebuild or sample community activity.

INSERT INTO content_objects(id,slug,title,kind,path,summary,current_json,media_json,is_public)
VALUES('system-damage','damage','Damage','system','/systems/damage','Localized hull and component damage in Fleet in Pieces. See actual development footage and discuss what a damaged ship should still be able to do.','["Weapons, engines and shields can fail independently","Hull damage changes what survives the fight","Lost thrust changes maneuvering and escape","A ship can be disabled before it is destroyed"]','[{"kind":"video","src":"/assets/video/damage-demo.mp4","poster":"/assets/images/damage-demo-poster.webp","width":576,"height":1024,"label":"Localized damage"}]',1)
ON CONFLICT(id) DO NOTHING;

INSERT INTO content_objects(id,slug,title,kind,path,summary,current_json,media_json,is_public)
VALUES('system-siege','siege','Siege weapons','system','/systems/siege','Siege weapons and planetary destruction in Fleet in Pieces. Watch the archived development footage and discuss the consequences.','["Siege weapons extend the fight beyond individual ships","Planetary rupture produces drifting debris","Fleet positioning still matters when the target is enormous"]','[{"kind":"video","src":"/assets/video/planet-killer.mp4","poster":"/assets/images/planet-killer-poster.webp","width":576,"height":1024,"label":"Planet breakup \u00b7 2\u00d7 speed"}]',1)
ON CONFLICT(id) DO NOTHING;

INSERT INTO content_objects(id,slug,title,kind,path,summary,current_json,media_json,is_public)
VALUES('ship-carriers','carriers','Carriers','ship','/ships/carriers','Carriers and fighter wings in Fleet in Pieces. Finite fuel, strike orders and recovery. Watch the development footage and contribute an idea.','["Carriers launch fighter wings","Fighter fuel is finite","Strike planning includes recovery","A surviving carrier is a home worth defending"]','[{"kind":"video","src":"/assets/video/carrier-wing.mp4","poster":"/assets/images/carrier-wing-poster.webp","width":576,"height":1024,"label":"Fighter launch"}]',1)
ON CONFLICT(id) DO NOTHING;

INSERT INTO content_objects(id,slug,title,kind,path,summary,current_json,media_json,is_public)
VALUES('ship-rescue','rescue','Rescue ships','ship','/ships/rescue','Rescue ships and jump extraction in Fleet in Pieces. Watch an actual development clip and discuss how to bring the fleet home.','["Rescue ships attach to damaged ships under fire","A prepared jump drive provides a way out","Momentum, fuel and positioning shape the approach","Extraction is a job for a real ship in the fight"]','[{"kind":"video","src":"/assets/video/jump-rescue.mp4","poster":"/assets/images/jump-rescue-poster.webp","width":576,"height":1024,"label":"Jump extraction"}]',1)
ON CONFLICT(id) DO NOTHING;
