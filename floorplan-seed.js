// Floorplan layout seed — fallback used by the Avail floor plan when Firestore
// has no floorplans/{propId} doc yet. The editor writes layouts to Firestore,
// which override this. Item kinds: u=unit (wired to live status by id), l=label
// (room/area box), n=note (free text). Coordinates are SVG units in the viewBox.
window.FLOORPLAN_SEED = {
  'pellissier-2720': {
    warehouse: {
      viewBox: '0 0 790 510',
      bg: null,
      items: [
        { k:'u', id:'D05', x:10,  y:10,  w:105, h:82 },
        { k:'u', id:'D03', x:123, y:10,  w:115, h:82 },
        { k:'u', id:'D04', x:246, y:10,  w:113, h:82 },
        { k:'u', id:'D02', x:367, y:10,  w:200, h:82 },
        { k:'u', id:'D01', x:575, y:10,  w:135, h:82 },
        { k:'l', t:'HALLWAY', x:10, y:100, w:700, h:14 },
        { k:'u', id:'B01', x:10,  y:122, w:468, h:378 },
        { k:'u', id:'C05', x:486, y:122, w:132, h:76 },
        { k:'u', id:'C04', x:486, y:198, w:132, h:76 },
        { k:'u', id:'C03', x:486, y:274, w:132, h:76 },
        { k:'u', id:'C02', x:486, y:350, w:132, h:76 },
        { k:'u', id:'C01', x:486, y:426, w:132, h:74 },
        { k:'u', id:'A02', x:626, y:122, w:154, h:95 },
        { k:'u', id:'A01', x:626, y:225, w:154, h:275 },
        { k:'n', t:'EXIT ↑', x:770, y:55, anchor:'end' }
      ]
    },
    office: {
      viewBox: '0 0 700 520',
      bg: null,
      items: [
        { k:'u', id:'R05', x:10,  y:10,  w:130, h:115 },
        { k:'u', id:'R06', x:10,  y:133, w:130, h:195 },
        { k:'u', id:'R07', x:10,  y:336, w:130, h:125 },
        { k:'l', t:'LOBBY', x:148, y:10, w:290, h:300, bg:'#f0fdf4', tc:'#4ade80' },
        { k:'l', t:'BREAKROOM', x:148, y:318, w:148, h:82 },
        { k:'l', t:'MEN',   x:304, y:318, w:80,  h:82 },
        { k:'l', t:'WOMEN', x:392, y:318, w:54,  h:82 },
        { k:'u', id:'R04', x:454, y:10,  w:118, h:82 },
        { k:'u', id:'R03', x:454, y:100, w:118, h:130 },
        { k:'u', id:'R02', x:454, y:238, w:118, h:155 },
        { k:'l', t:'SERVER', x:454, y:401, w:118, h:60 },
        { k:'u', id:'R08', x:148, y:408, w:175, h:102 },
        { k:'u', id:'R09', x:331, y:408, w:175, h:102 },
        { k:'u', id:'R01', x:580, y:408, w:108, h:102 },
        { k:'n', t:'FRONT ENTRANCE', x:295, y:515, anchor:'middle' }
      ]
    }
  }
};
