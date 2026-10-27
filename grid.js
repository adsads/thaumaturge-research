// Hex-grid input: place 2+ aspect nodes (and holes), then fill in the aspects that connect them.
$(function(){
	var SIZE = 30, SQ3 = Math.sqrt(3);
	var DIRS = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
	var radius = 3, cells = {}; // "q,r" -> {type:"node"|"hole"|"fill", aspect}
	function key(q, r) { return q + "," + r; }
	function inGrid(q, r) { return Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= radius; }
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
		var w = SIZE * (3 * radius + 2), h = SQ3 * SIZE * (2 * radius + 1) + SIZE;
		var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '">';
		for (var q = -radius; q <= radius; q++) for (var r = -radius; r <= radius; r++) {
			if (!inGrid(q, r)) continue;
			var c = cells[key(q, r)] || {}, x = w / 2 + SIZE * 1.5 * q, y = h / 2 + SQ3 * SIZE * (r + q / 2);
			var pts = [0,1,2,3,4,5].map(function(i){
				var a = Math.PI / 3 * i; return (x + SIZE * Math.cos(a)) + "," + (y + SIZE * Math.sin(a));
			}).join(" ");
			var fill = c.type == "hole" ? "#3a3126" : c.type == "node" ? "#f3d98b" : c.type == "fill" ? "#cfe3f5" : "#f4e9cf";
			svg += '<g data-q="' + q + '" data-r="' + r + '" style="cursor:pointer"><polygon points="' + pts + '" fill="' + fill + '" stroke="#8a7a55" stroke-width="' + (c.type == "node" ? 3 : 1) + '"/>';
			if (c.aspect) svg += '<title>' + c.aspect + '</title><image href="aspects/color/' + translate[c.aspect] + '.png" x="' + (x - 16) + '" y="' + (y - 20) + '" width="32" height="32"/>'
				+ '<text x="' + x + '" y="' + (y + 18) + '" font-size="9" text-anchor="middle" fill="#333">' + translate[c.aspect] + '</text>';
			svg += '</g>';
		}
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
	$("#grid_radius").change(function(){ radius = +this.value; cells = {}; render(); });
	$("#version").change(function(){ cells = {}; aspectOptions(); render(); });
	aspectOptions(); render();
});
