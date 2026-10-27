// Hex-grid input: place 2+ aspect nodes (and holes), then fill in the aspects that connect them.
$(function(){
	var SIZE = 30, SQ3 = Math.sqrt(3);
	// Flat-top hexes copied from the in-game research table: q = column, r = half-row (neighbours: same column r+-2, next column r+-1).
	var DIRS = [[0,2],[0,-2],[1,1],[1,-1],[-1,1],[-1,-1]];
	var LAYOUT = {0: [4,6,8], 1: [1,3,5,7,9], 2: [0,2,4,6,8,10], 3: [1,3,7,9,11], 4: [0,2,4,6,8,10], 5: [3,5,7,9], 6: [2,4,6,8]};
	var cells = {}; // "q,r" -> {type:"node"|"hole"|"fill", aspect}
	function key(q, r) { return q + "," + r; }
	function inGrid(q, r) { return !!LAYOUT[q] && LAYOUT[q].indexOf(r) >= 0; }
	function usable(a) { return !$("#" + a).hasClass("unavail"); }
	function cost(a) { return usable(a) ? 1 : 100; }

	function aspectOptions() {
		var sel = $("#grid_aspect").empty();
		$("#avail > li").each(function(){
			var a = this.id;
			sel.append($("<option>").val(a).text(translate[a] + " (" + a + ")"));
		});
	}

	function render() {
		var w = SIZE * 1.5 * 6 + 2 * SIZE + 8, h = SQ3 / 2 * SIZE * 11 + SQ3 * SIZE + 8;
		var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '">';
		for (var q = 0; q <= 6; q++) LAYOUT[q].forEach(function(r){
			var c = cells[key(q, r)] || {}, x = SIZE + 4 + SIZE * 1.5 * q, y = SQ3 / 2 * SIZE * (r + 1) + 4;
			var pts = [0,1,2,3,4,5].map(function(i){
				var a = Math.PI / 3 * i; return (x + SIZE * Math.cos(a)) + "," + (y + SIZE * Math.sin(a));
			}).join(" ");
			var fill = c.type == "hole" ? "#3a3126" : c.type == "node" ? "#f3d98b" : c.type == "fill" ? "#cfe3f5" : "#f4e9cf";
			svg += '<g data-q="' + q + '" data-r="' + r + '" style="cursor:pointer"><polygon points="' + pts + '" fill="' + fill + '" stroke="#8a7a55" stroke-width="' + (c.type == "node" ? 3 : 1) + '"/>';
			if (c.aspect) svg += '<title>' + c.aspect + '</title><image href="aspects/color/' + translate[c.aspect] + '.png" x="' + (x - 16) + '" y="' + (y - 20) + '" width="32" height="32"/>'
				+ '<text x="' + x + '" y="' + (y + 18) + '" font-size="9" text-anchor="middle" fill="#333">' + translate[c.aspect] + '</text>';
			svg += '</g>';
		});
		$("#grid_svg").html(svg + "</svg>");
	}

	function clearFill() { $.each(cells, function(k, c){ if (c.type == "fill") delete cells[k]; }); }

	// Cheapest chain of linked aspects from the current tree to `target`; each cell holds one aspect.
	function connectOne(tree, target, nodes) {
		var dist = {}, parent = {}, open = [];
		function id(q, r, a) { return key(q, r) + "|" + a; }
		$.each(tree, function(k, a){
			var qr = k.split(",").map(Number), s = id(qr[0], qr[1], a);
			dist[s] = 0; open.push({s: s, q: qr[0], r: qr[1], a: a, d: 0});
		});
		while (open.length) {
			open.sort(function(x, y){ return y.d - x.d; });
			var cur = open.pop();
			if (cur.d > dist[cur.s]) continue;
			if (cur.q == target.q && cur.r == target.r) {
				var path = []; for (var s = cur.s; parent[s]; s = parent[s]) path.push(s);
				return path.reverse().map(function(p){ var t = p.split("|"), qr = t[0].split(",").map(Number); return {q: qr[0], r: qr[1], a: t[1]}; });
			}
			var onPath = {}; for (var p = cur.s; p; p = parent[p]) onPath[p.split("|")[0]] = 1;
			for (var i = 0; i < 6; i++) {
				var nq = cur.q + DIRS[i][0], nr = cur.r + DIRS[i][1], k = key(nq, nr);
				if (!inGrid(nq, nr) || onPath[k] || k in tree) continue;
				var cell = cells[k], isTarget = nq == target.q && nr == target.r;
				if (cell && !isTarget) continue; // holes and other nodes block
				(graph[cur.a] || []).forEach(function(b){
					if (isTarget && b != target.aspect) return;
					var nd = cur.d + (isTarget ? 0 : cost(b)), s = id(nq, nr, b);
					if (!(s in dist) || nd < dist[s]) { dist[s] = nd; parent[s] = cur.s; open.push({s: s, q: nq, r: nr, a: b, d: nd}); }
				});
			}
		}
		return null;
	}

	function solve() {
		clearFill();
		var nodes = [];
		$.each(cells, function(k, c){ if (c.type == "node") { var qr = k.split(",").map(Number); nodes.push({q: qr[0], r: qr[1], aspect: c.aspect}); } });
		if (nodes.length < 2) { $("#grid_msg").text("Place at least 2 aspect nodes first."); return; }
		var best = null;
		nodes.forEach(function(start, i){ // greedy: grow a tree from each start node, keep the cheapest
			var tree = {}, added = [], total = 0, left = nodes.filter(function(n){ return n != start; });
			tree[key(start.q, start.r)] = start.aspect;
			while (left.length) {
				var pick = null;
				left.forEach(function(t){
					var p = connectOne(tree, t, nodes);
					if (p && (!pick || p.length < pick.path.length)) pick = {t: t, path: p};
				});
				if (!pick) return;
				pick.path.forEach(function(s){ tree[key(s.q, s.r)] = s.a; if (!(key(s.q, s.r) in cells)) { added.push(s); total += cost(s.a); } });
				left.splice(left.indexOf(pick.t), 1);
			}
			if (!best || total < best.total) best = {total: total, added: added};
		});
		if (!best) { $("#grid_msg").text("No connection found. Remove holes, enlarge the grid, or enable more aspects."); render(); return; }
		best.added.forEach(function(s){ if (!cells[key(s.q, s.r)]) cells[key(s.q, s.r)] = {type: "fill", aspect: s.a}; });
		$("#grid_msg").text("Filled " + best.added.length + " cells.");
		render();
	}

	$("#grid_svg").on("click", "g", function(){
		var k = key($(this).data("q"), $(this).data("r")), tool = $("input[name=grid_tool]:checked").val();
		if (tool == "node") cells[k] = {type: "node", aspect: $("#grid_aspect").val()};
		else if (tool == "hole") cells[k] = {type: "hole"};
		else delete cells[k];
		clearFill(); $("#grid_msg").text(""); render();
	});
	$("#grid_solve").click(solve);
	$("#grid_clear").click(function(){ cells = {}; $("#grid_msg").text(""); render(); });
	$("#version").change(function(){ cells = {}; aspectOptions(); render(); });
	aspectOptions(); render();
});
