// Drag-and-drop hex grid: drop 2+ aspects on the grid and the cells between them are filled in.
(function(){
	var SIZE = 34, SQ3 = Math.sqrt(3), PAD = 6, SVGNS = "http://www.w3.org/2000/svg";
	// Flat-top hexes as on the in-game table: q = column, r = half-row (neighbours: same column r+-2, next column r+-1).
	var DIRS = [[0,2],[0,-2],[1,1],[1,-1],[-1,1],[-1,-1]];
	// Note size follows research complexity: radius = 1 + complexity (see NoteGenerator in the mod). Holes are random in-game;
	// these are the ones from a complexity-2 note you captured.
	var FULL, R, U0;
	var DEFAULT_HOLES = ["0,2", "3,-1", "3,5", "5,1"];
	function setComplexity(c) {
		R = 1 + c; U0 = 2 * R - 1; FULL = {};
		for (var q = 0; q <= 2 * R; q++) {
			var n = R + 1 + Math.min(q, 2 * R - q), first = U0 - (n - 1);
			FULL[q] = []; for (var i = 0; i < n; i++) FULL[q].push(first + 2 * i);
		}
		holes = {}; if (c == 2) DEFAULT_HOLES.forEach(function(k){ holes[k] = 1; });
		document.getElementById("complexity").value = c;
	}
	// Outer-ring cells in angular order (in-game the research aspects sit on this ring).
	function ring() {
		var out = [];
		Object.keys(FULL).forEach(function(q){ FULL[q].forEach(function(r){
			var dq = q - R, z = (r - U0 - dq) / 2;
			if (Math.max(Math.abs(dq), Math.abs(z), Math.abs(dq + z)) == R) out.push({k: key(q, r), ang: Math.atan2((r - U0) * SQ3 / 2, 1.5 * dq)});
		}); });
		return out.sort(function(a, b){ return a.ang - b.ang; });
	}
	var data = version_dictionary.Thaumaturge, combos = data.combinations;
	var aspects = data.base_aspects.concat(Object.keys(combos).sort(function(a, b){ return translate[a].localeCompare(translate[b]); }));
	var graph = {};
	function link(a, b) { (graph[a] = graph[a] || []).push(b); (graph[b] = graph[b] || []).push(a); }
	Object.keys(combos).forEach(function(c){ link(c, combos[c][0]); link(c, combos[c][1]); });

	var nodes = {}, fills = {}, holes = {}, disabled = {};
	try { JSON.parse(localStorage.getItem("thm_disabled") || "[]").forEach(function(a){ disabled[a] = 1; }); } catch (e) {}

	function key(q, r) { return q + "," + r; }
	function inGrid(q, r) { return !!FULL[q] && FULL[q].indexOf(r) >= 0; }
	function cost(a) { return disabled[a] ? 100 : 1; }
	function name(a) { var n = translate[a]; return n.charAt(0).toUpperCase() + n.slice(1); }
	function icon(a) { return "aspects/color/" + translate[a] + ".png"; }
	function parse(k) { var p = k.split(",").map(Number); return {q: p[0], r: p[1]}; }
	function el(tag, attrs, parent) {
		var e = document.createElementNS(SVGNS, tag);
		for (var k in attrs) e.setAttribute(k, attrs[k]);
		if (parent) parent.appendChild(e);
		return e;
	}

	// Cheapest chain of linked aspects from the tree to `target`; every cell holds one aspect.
	function connectOne(tree, target) {
		var tk = key(target.q, target.r), dist = {}, parent = {}, open = [];
		Object.keys(tree).forEach(function(k){
			var p = parse(k), s = k + "|" + tree[k];
			dist[s] = 0; open.push({s: s, q: p.q, r: p.r, a: tree[k], d: 0});
		});
		while (open.length) {
			open.sort(function(x, y){ return y.d - x.d; });
			var cur = open.pop();
			if (cur.d > dist[cur.s]) continue;
			var ck = key(cur.q, cur.r), onPath = {};
			if (ck == tk) {
				var path = [];
				for (var s = cur.s; parent[s]; s = parent[s]) path.push(s);
				return path.reverse().map(function(x){ var t = x.split("|"), p = parse(t[0]); return {q: p.q, r: p.r, a: t[1]}; });
			}
			for (var p = cur.s; p; p = parent[p]) onPath[p.split("|")[0]] = 1;
			for (var i = 0; i < 6; i++) {
				var nq = cur.q + DIRS[i][0], nr = cur.r + DIRS[i][1], k = key(nq, nr), isT = k == tk;
				if (!inGrid(nq, nr) || onPath[k] || k in tree || holes[k] || (k in nodes && !isT)) continue;
				(graph[cur.a] || []).forEach(function(b){
					if (isT && b != target.aspect) return;
					var nd = cur.d + (isT ? 0 : cost(b)), s = k + "|" + b;
					if (!(s in dist) || nd < dist[s]) { dist[s] = nd; parent[s] = cur.s; open.push({s: s, q: nq, r: nr, a: b, d: nd}); }
				});
			}
		}
		return null;
	}

	// Greedy Steiner tree: grow from each node in turn, keep the cheapest result.
	function solve() {
		fills = {};
		var list = Object.keys(nodes).map(function(k){ var p = parse(k); return {q: p.q, r: p.r, aspect: nodes[k]}; });
		if (list.length < 2) return list.length ? "" : "Drag an aspect onto the grid to start.";
		var best = null;
		list.forEach(function(start){
			var tree = {}, added = {}, total = 0, left = list.filter(function(n){ return n != start; });
			tree[key(start.q, start.r)] = start.aspect;
			while (left.length) {
				var pick = null;
				left.forEach(function(t){
					var p = connectOne(tree, t);
					if (p && (!pick || p.length < pick.path.length)) pick = {t: t, path: p};
				});
				if (!pick) return;
				pick.path.forEach(function(s){
					var k = key(s.q, s.r); tree[k] = s.a;
					if (!(k in nodes) && !(k in added)) { added[k] = s.a; total += cost(s.a); }
				});
				left.splice(left.indexOf(pick.t), 1);
			}
			if (!best || total < best.total) best = {total: total, added: added};
		});
		if (!best) return "No connection found. Remove holes or enable more aspects.";
		fills = best.added;
		return Object.keys(fills).length + " cells filled";
	}

	function render() {
		var status = solve(), svg = document.getElementById("grid");
		var W = SIZE * 3 * R + 2 * SIZE + 2 * PAD, H = SQ3 / 2 * SIZE * (4 * R + 2) + 2 * PAD;
		svg.setAttribute("viewBox", "0 0 " + W + " " + H);
		svg.textContent = "";
		Object.keys(FULL).forEach(function(q){
			FULL[q].forEach(function(r){
				var k = key(q, r), a = nodes[k] || fills[k], x = SIZE + PAD + SIZE * 1.5 * q, y = PAD + SQ3 / 2 * SIZE * (r + 2);
				var g = el("g", {"data-k": k, "class": k in nodes ? "node" : holes[k] ? "hole" : a ? "fill" : ""}, svg);
				var pts = [0,1,2,3,4,5].map(function(i){ var t = Math.PI / 3 * i; return (x + SIZE * Math.cos(t)).toFixed(1) + "," + (y + SIZE * Math.sin(t)).toFixed(1); }).join(" ");
				el("polygon", {points: pts, "class": "cell"}, g);
				if (a) {
					el("image", {href: icon(a), x: x - 16, y: y - 22, width: 32, height: 32}, g);
					el("text", {x: x, y: y + 20}, g).textContent = name(a);
				}
			});
		});
		document.getElementById("status").textContent = status;
		var used = {};
		Object.keys(fills).forEach(function(k){ used[fills[k]] = (used[fills[k]] || 0) + 1; });
		var box = document.getElementById("used"); box.textContent = "";
		Object.keys(used).forEach(function(a){
			var s = document.createElement("span"); s.className = "pill";
			s.innerHTML = '<img src="' + icon(a) + '" alt="">' + name(a) + " ×" + used[a];
			box.appendChild(s);
		});
	}

	function renderPalette() {
		var p = document.getElementById("palette"); p.textContent = "";
		aspects.forEach(function(a){
			var c = document.createElement("div");
			c.className = "chip" + (disabled[a] ? " off" : ""); c.setAttribute("data-aspect", a);
			c.innerHTML = '<img src="' + icon(a) + '" alt="" onerror="this.style.visibility=\'hidden\'">' + name(a);
			p.appendChild(c);
		});
	}
	function saveDisabled() { try { localStorage.setItem("thm_disabled", JSON.stringify(Object.keys(disabled))); } catch (e) {} }

	// Pointer-based drag so it works with mouse and touch; a press without movement is a click.
	var drag = null;
	function cellAt(x, y) { var e = document.elementFromPoint(x, y), g = e && e.closest && e.closest("#grid g[data-k]"); return g; }
	document.addEventListener("pointerdown", function(e){
		var chip = e.target.closest(".chip"), g = e.target.closest("#grid g[data-k]");
		if (chip) drag = {aspect: chip.getAttribute("data-aspect"), chip: chip};
		else if (g) { var k = g.getAttribute("data-k"); drag = {aspect: nodes[k], from: k}; }
		else return;
		drag.x = e.clientX; drag.y = e.clientY; drag.moved = false;
		e.preventDefault();
	});
	document.addEventListener("pointermove", function(e){
		if (!drag) return;
		if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
		if (!drag.aspect) return;
		if (!drag.moved) {
			drag.moved = true;
			drag.ghost = document.createElement("img"); drag.ghost.src = icon(drag.aspect); drag.ghost.className = "ghost";
			document.body.appendChild(drag.ghost);
		}
		drag.ghost.style.left = e.clientX + "px"; drag.ghost.style.top = e.clientY + "px";
		var over = cellAt(e.clientX, e.clientY);
		document.querySelectorAll("#grid g.drop").forEach(function(n){ n.classList.remove("drop"); });
		if (over) over.classList.add("drop");
	});
	document.addEventListener("pointerup", function(e){
		if (!drag) return;
		var d = drag; drag = null;
		if (d.ghost) d.ghost.remove();
		if (!d.moved) {
			if (d.chip) { var a = d.aspect; if (disabled[a]) delete disabled[a]; else disabled[a] = 1; saveDisabled(); d.chip.classList.toggle("off"); }
			else if (d.from in nodes) delete nodes[d.from];
			else if (holes[d.from]) delete holes[d.from];
			else holes[d.from] = 1;
		} else if (d.aspect) {
			var g = cellAt(e.clientX, e.clientY), displaced;
			if (d.from) { displaced = nodes[g && g.getAttribute("data-k")]; delete nodes[d.from]; }
			if (g) {
				var k = g.getAttribute("data-k");
				displaced = nodes[k]; delete holes[k]; nodes[k] = d.aspect;
				if (d.from && displaced) nodes[d.from] = displaced;
			}
		}
		render();
	});
	document.addEventListener("pointercancel", function(){ if (drag && drag.ghost) drag.ghost.remove(); drag = null; });

	document.getElementById("reset").addEventListener("click", function(){
		nodes = {}; setComplexity(R - 1); render();
	});
	document.getElementById("complexity").addEventListener("change", function(){
		var old = nodes; nodes = {}; setComplexity(+this.value);
		Object.keys(old).forEach(function(k){ var p = parse(k); if (inGrid(p.q, p.r) && !holes[k]) nodes[k] = old[k]; });
		render();
	});
	var research = document.getElementById("research"), menu = document.getElementById("research_list"), shown = [], active = -1;
	function label(e) { return e.name; }
	function showMenu() {
		var q = research.value.trim().toLowerCase(), last = "";
		shown = research_dictionary.filter(function(e){ return !q || e.name.toLowerCase().indexOf(q) >= 0 || e.category.indexOf(q) >= 0; });
		menu.textContent = ""; active = -1;
		shown.forEach(function(e, i){
			if (e.category != last) { last = e.category; var h = document.createElement("li"); h.className = "grp"; h.textContent = last; menu.appendChild(h); }
			var li = document.createElement("li"); li.textContent = label(e); li.setAttribute("data-i", i); li.setAttribute("role", "option"); menu.appendChild(li);
		});
		if (!shown.length) { var n = document.createElement("li"); n.className = "grp"; n.textContent = "No match"; menu.appendChild(n); }
		menu.hidden = false; research.setAttribute("aria-expanded", "true");
	}
	function hideMenu() { menu.hidden = true; research.setAttribute("aria-expanded", "false"); }
	function highlight(i) {
		var items = menu.querySelectorAll("li[data-i]");
		if (!items.length) return;
		active = (i + items.length) % items.length;
		items.forEach(function(n, j){ n.classList.toggle("active", j == active); });
		items[active].scrollIntoView({block: "nearest"});
	}
	research.addEventListener("focus", showMenu);
	research.addEventListener("input", showMenu);
	research.addEventListener("keydown", function(ev){
		if (ev.key == "ArrowDown") { if (menu.hidden) showMenu(); highlight(active + 1); ev.preventDefault(); }
		else if (ev.key == "ArrowUp") { highlight(active - 1); ev.preventDefault(); }
		else if (ev.key == "Enter" && shown[active]) { pick(shown[active]); ev.preventDefault(); }
		else if (ev.key == "Escape") hideMenu();
	});
	menu.addEventListener("mousedown", function(ev){
		var li = ev.target.closest("li[data-i]");
		if (li) { pick(shown[+li.getAttribute("data-i")]); ev.preventDefault(); }
	});
	document.addEventListener("pointerdown", function(ev){ if (!ev.target.closest(".combo")) hideMenu(); }, true);
	function pick(e) { research.value = label(e); hideMenu(); research.blur(); loadResearch(e); }
	function loadResearch(e) {
		nodes = {}; setComplexity(e.complexity);
		var cells = ring();
		e.aspects.forEach(function(a, i){ nodes[cells[Math.floor((i + .5) * cells.length / e.aspects.length)].k] = a; });
		render();
		document.getElementById("status").textContent += " \u2014 positions are random in-game, drag the aspects to match your note";

	}
	document.getElementById("enable_all").addEventListener("click", function(){ disabled = {}; saveDisabled(); renderPalette(); render(); });
	document.getElementById("disable_all").addEventListener("click", function(){ aspects.forEach(function(a){ disabled[a] = 1; }); saveDisabled(); renderPalette(); render(); });
	setComplexity(2); renderPalette(); render();
})();
