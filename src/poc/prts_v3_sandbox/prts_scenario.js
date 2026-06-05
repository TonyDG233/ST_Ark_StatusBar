const $enum = {
        res: { skip: -2, error: -1, dynamic: 0, next: 1, wait: 2 },
        setting: { pre: -10, resume: -2, close: -1, reset: 0, open: 1, suspend: 2 },
        log: { trace: -2, debug: -1, info: 0, warn: 1, error: 2, sp1: 11, sp2: 12 },
    };
    let ResType = $enum.res, SetType = $enum.setting, LogType = $enum.log;
const dec_limit_px = 450,log_limit_px = 582,log_em_limit_px = 200,wait_trigger = 150,base_width = 960,base_height = 540,pos_multiply = 0.75;
const queue = new createjs.LoadQueue(false);
queue.installPlugin(createjs.Sound);
var public_disabled = false;
var timer = new Timer();
var system = {
	page: "",
	sourceUrl: "https://static.prts.wiki/",
	assetUrl: "https://torappu.prts.wiki/assets/",
	debug: document.URL.includes("&debug=true"),
	/*  debug: true, */
	error:{type:"",info:undefined,stat:false},
	txt:{max:0,index:0,name:"",now:"",now_temp:"",now_index:0,dynamic:undefined,
		init(){
			this.now_index = 0;
			this.now_temp = "";
		},
		over(){
			this.now_index = this.now.length;
			this.now_temp = this.now;
		},
		checkBind(id) {
			var self = this;
			if (!self.dynamic || !self.dynamic.id)
				return false;

			return self.dynamic.id.endsWith(id);
		},
		delay:{
			word: 30,per: 50,common: 1500,
			set(tar, value){
				var self = this;
				if(self[tar] && value) self[tar] = value;
			},
			reset(tar){
				var self = this;
				if(tar === "all"){
					self.word = 30;
					self.per = 50;
					self.common = 1500;
				}
				else if(tar === "word"){
					self.word = 30;
				}
				else if(tar === "per"){
					self.per = 50;
				}
				else if(tar === "common"){
					self.common = 1500;
				}
			}
		}
	},
	flag:{auto:0,respond:0,skip:0,load:0},
	stats:{reset:false,click:false,theater:false,auto:false,log_all:true,step:false,report:false,log_suppress:false},
	decision:{mode:false,select:1,values:[-1,-1,-1]},
	disabled:{
		flag:false,
		note:"",
		init(){
			let sets = data.setting.disable;
			for(let p in sets.prefix){
				if(!system.page.startsWith(p)) continue;
				this.flag = true;
				this.note = sets.prefix[p];
				return;
			}
			for(let t in sets.title){
				if(system.page !== t) continue;
				this.flag = true;
				this.note = sets.title[p];
				return;
			}
		}
	},
	source:{},
	multi:{
		mode:false,
		check(){
			if(!this.mode) return false;
			this.end();
			this.init();
			return true;
		},
		init(){
			system.txt.init();
		},
		begin(){
			this.init();
			this.mode = true;
		},
		end(tar = "@p"){
			fun_playback(tar,system.txt.name);
			this.reset();
		},
		reset(){
			system.txt.delay.reset("word");
			/* this.init(); */
			this.mode = false;
		}
	},
	auto:{
		mode: false,
		flag: 0,
		toggle(){
			var self = this;
			if(self.mode) self.stop();
			else self.start();
		},
		start(){
			var self = this;
			self.mode = true;
			if(system.txt.index == 0) fun_setting("pre");
			timer.clear("auto");
			self.flag = 1;
			self.resume();
		},
		stop(){
			var self = this;
			timer.clear("auto");
			document.getElementById("button_auto").innerHTML = "";
			self.mode = false;
		},
		suspend(){
			var self = this;
			if(!self.mode) return;
			timer.clear("auto");
		},
		resume(){
			var self = this;
			if(!self.mode) return;
			timer.create("auto",timer_auto, 400, true);
			self.checkNext();
		},
		checkNext(){
			if(!system.stats.click || timer.hasTimer("dynamic") || timer.hasTimer("txt")) return;
			txt_next();
		}
	},
	skipnode: { stat: false, waitTarget: null },
	preload:{
		start(){
			var self = this.handler;
			fun_msg(2,false,"Source start loading...");
			queue.load();
			var c = document.getElementById("sys_clicker");
			c.removeEventListener("mousedown", self.begin);
			c.removeEventListener("mouseup", self.end);
			c.removeEventListener("mouseleave", self.end);
			c.removeEventListener("touchstart", self.begin);
			c.removeEventListener("touchend", self.end);
			c.removeEventListener("touchcancel", self.end);
		},
		init(){
			queue.on("fileload",(e)=>{
				fun_msg(0,true,"Source Loaded:",e.item.src);
				document.getElementById("dialog_output").innerHTML = "正在载入资源:"+e.item.src.getValue("/");
			});
			queue.on("complete", function(){
				fun_msg(2,false,"All source loaded complete.");
				system.preload.complete();
			},this, true);
			var self = this.handler,clicker = document.getElementById("sys_clicker");
			clicker.addEventListener("mousedown",self.begin);
			clicker.addEventListener("mouseup",self.end);
			clicker.addEventListener("mouseleave",self.end);
			clicker.addEventListener("touchstart",self.begin);
			clicker.addEventListener("touchend",self.end);
			clicker.addEventListener("touchcancel",self.end);
		},
		complete(){
			var auto = document.getElementById("button_auto"),main = document.getElementById("sys_main"),clicker = document.getElementById("sys_clicker");
			clicker.addEventListener("click", function(ev){txt_click();ev.preventDefault();});
			clicker.addEventListener("mousedown", fun_skip_start);
			clicker.addEventListener("mouseup", fun_skip_stop);
			clicker.addEventListener("mouseleave", fun_skip_stop);
			clicker.addEventListener("touchstart", fun_skip_start);
			clicker.addEventListener("touchend", fun_skip_stop);
			clicker.addEventListener("touchleave", fun_skip_stop);
			document.getElementById("button_reset").addEventListener("click",(ev)=>{
				var stats = system.stats;
				if (system.skipnode.stat) {
                    fun_msg(1, true, "skipnode mode triggered.");
                    if (system.skipnode.waitTarget) {
                        system.skipnode.waitTarget.remove();
                        txt_next();
                    }
                    return;
                }
				else if(!stats.reset || stats.report){
					fun_msg(0,true,"reset didn't pass.");
					return;
				}
				if(timer.hasTimer("auto")) fun_auto_stop();
				if(timer.hasTimer("dynamic")) txt_stop();
				fun_setting("reset");
				document.getElementById("dialog_output").innerHTML = "剧情模拟已重置，单击开始剧情回顾";
				ev.preventDefault();
			});
			main.addEventListener("mousemove",function(e){
				var self = this;
				self.style.cursor = "default";
				if(!fun_fullscreen_check()) return;
				timer.clear("mousehide");
				timer.create("mousehide",function(){
					self.style.cursor = "none";
				},1500);
				e.preventDefault();
			});
			document.addEventListener("keydown",function(ev){
				if(system.debug && ev.ctrlKey){
					var eles = document.getElementsByClassName("dialog_style header");
					if(eles){
						eles[0].classList.toggle("debug");
					}
				}
			});
			auto.addEventListener("click",function(ev){
				var stats = system.stats;
				if((!stats.click && system.txt.max == 0) || stats.theater || stats.report){
					fun_msg(0,true,"auto didn't pass.");
					return 0;
				}
				if(!stats.auto){
					stats.auto = true;
					if(system.txt.index == 0) fun_setting("pre");
					timer.clear("auto");
					system.flag.auto = 1;
					timer.create("auto", timer_auto, 400, true);
					if(stats.click && !timer.hasTimer("dynamic") && !timer.hasTimer("txt")) txt_next();
				}
				else{
					fun_auto_stop();
				}
				ev.preventDefault();
			});
			/* property */
			var sets = system.stats;
			auto.classList.remove("forbid");
			sets.click = true;
			if(system.error.stat){
				document.getElementById("dialog_output").innerHTML = "部分数据预载入异常，本次剧情回顾可能存在图片/音频消失的情况。LOG ALL已禁用<br/>单击开始剧情回顾";
				sets.log_all = false;
			}
			else{
				document.getElementById("dialog_output").innerHTML = "资源加载完毕。单击开始剧情回顾";
			}
			if(sets.log_all) document.getElementById("button_playback_all").setShow();
			if(fun_fullscreen_support()) document.getElementById("button_fullscreen").setShow();
			if(system.user.client == "desktop") document.getElementById("button_report").setShow();
		},
		handler:{
			begin: function(e){
				if(timer.hasTimer("preload_wait")) return;
				timer.create("preload_wait",function(){
					system.preload.start();
				}, 1000);
			},
			end: function(e){
				timer.clear("preload_wait");
			},
		}
	},
	user:{name:"",client:"",display:""},
	ui:{
		width: 960,
		height: 540,
		multiply: 0.75,
		applySkipNode() {
		var btn = document.getElementById("button_reset");
		if (system.skipnode.stat) {
			btn.classList.add("skipnode");
		}
		else {
			btn.classList.remove("skipnode");
		}
	}
	}
};
const scenario = {
	index: 0,
	max: 0,
	regex: {
		space: "^\\s+$",
		comment: "^\\s*//.*$",
		command: "^\\[\\s*(?:(.*?)\\((.*)\\)|(?:([\\.|\\w]*)|(.*)))\\s*\\]\\s*(.*)",
		animatepara: "<p=(\\d+)>(.*?)<\\/>",
	},
	extend: {
		charLink: function (str) {
			var link = data.link;
			let n, i;
			if (str.match(scenario.regex.space)) {
				support.log(LogType.error, false, "The input parameter is empty,has skipped the data.");
				return [-1, -1];
			}
			let m = str.trim().match(/^([^@#$]+)(?:([@#$])([a-z\d]+)|#(\d+)\$(\d+))?$/);
			support.log(LogType.trace, true, "regex match: ", m);
			if (!m) {
				support.log(LogType.error, false, "Can't get key from the input parameter,has skipped the data.");
				return [-1, -1];
			}
			n = m[1], i = m[3];
			if (!link[n]) {
				support.log(LogType.warn, false, `The appointed key [${n}] not exist,has skipped the data.`);
				return [-1, -1];
			}
			if (m[2] == '$' || (m[4] && m[5])) {
				let g = '$' + (m[5] || i);//group
				i = m[4] || i;
				let ps = link[n].array.findIndex((v) => v.name.endsWith(g)), pe = link[n].array.findIndex((v, vi) => !v.name.endsWith(g) && vi > ps);
				if (ps == -1) {
					support.log(LogType.warn, false, `The analyze key [${n}:${i}] not exist,use the default char to instead.`);
					return [n, 0];
				}
				pe = pe == -1 ? link[n].array.length - 1 : pe - 1;
				if (m[2]) return [n, ps];
				try {
					i--;
				}
				catch (err) {
					support.log(LogType.warn, false, "Data analyze error,use the default char to instead.");
					i = ps;
				}
				if (i > pe - ps) {
					support.log(LogType.warn, false, `The analyze key [${n}:${i}] is out of range,use the default char to instead.`);
					i = ps;
				}
				return [n, i + ps];
			}
			else if (m[2] == "#") {
				try {
					i--;
				}
				catch (err) {
					support.log(LogType.warn, false, "Data analyze error,use the default char to instead.");
					i = 0;
				}
				if (i >= link[n].array.length) {
					support.log(LogType.warn, false, `The analyze key [${n}:${i}] is out of range,use the default char to instead.`);
					i = 0;
				}
				return [n, i];
			}
			else if (m[2] == '@') {
				for (let i = 0; i < link[n].array.length; i++) if (link[n].array[i].alias == i) return [n, i];
				support.log(LogType.warn, false, "Data analyze error,use the default char to instead.");
				return [n, 0];
			}
			return [n, 0];
		},
		charFormat: function (key, idx) {
			var link = data.link;
			if (link[key] == undefined) {
				support.log(LogType.error, false, `Character key [${key}] not exist,please check the link list.`);
				return key;
			}
			return link[key].array[idx].name;
		},
		charPos: function (key, pos = 0) {
			var link = data.link;
			let px, py, sx, sy;
			px = link[key].pos.x * 0.75;
			py = link[key].pos.y * 0.75;
			sx = link[key].size.x * 0.75;
			sy = link[key].size.y * 0.75;
			switch (pos) {
				case -1:
					px = 330 - sx / 2 + px;
					break;
				case 0:
					px = 480 - sx / 2 + px;
					break;
				case 1:
					px = 630 - sx / 2 + px;
					break;
			}
			py = 540 - sy / 2 - py;
			return [sx, sy, px, py];
		},
		replaceTxt: function (str) {
			if (!str)
				return "";

			return str.replace(/{@nickname}/ig, system.user.name).replace(/{@nbs}/ig, " ");
		},
		formatTime: function (time) {
			let arr = [Math.floor(time / 3600), Math.floor((time % 3600) / 60), Math.floor(time % 60)];
			for (let i = 0; i < arr.length; i++) {
				arr[i] = arr[i] < 10 ? "0" + arr[i].toString() : arr[i].toString();
			}
			return `${arr[0]}:${arr[1]}:${arr[2]}`;
		},
		formatTxt: function (str) {
			if (!str)
				return "";

			let t = scenario.extend.replaceTxt(str);
			t = t.replace(/<color=/ig, "<font color=").replace(/<\/color>/ig, "</font>");
			t = t.replace(/ /g, "&nbsp;");
			// t = t.replace(/{@s}/ig, "");
			t = t.replace(/\\n/g, "<br/>");
			return t;
		},
		getAudioUrl: function (key) {
			if (!key) return "";
			let p = key.toLowerCase();
			return key.startsWith("$") ? data.audio[p.substr(1)] : key.startsWith("@") ? system.assetUrl + p.substr(1) : system.assetUrl + p.replace("sound_beta_2", "music") + ".mp3";
		},
		serialize: function (header, obj) {
			var res = [];
			for (var [k, v] of Object.entries(obj)) {
				if (v == undefined) continue;
				res.push(`${k}="${v}"`);
			}
			return `[${header}(${res.join(', ')})]`;
		},
	},
}
    const support = {
        /**
         * @param {HTMLCanvasElement} can
         * @param {String} url
         * @param {Number} w
         * @param {Number} h
         * @param {Number[]} black
        */
        drawChar: function (can, url, w, h, ...black) {
            var img = new Image();
            img.src = url;
            img.onload = function () {
                if (can.width != w || can.height != h) {
                    can.width = w;
                    can.height = h;
                }
                support.log(LogType.trace, true, `<DrawChar>url: ${this.src},imgW: ${this.width},imgH: ${this.height}`);
                var ctx = can.getContext("2d");
                ctx.clearRect(0, 0, w, h);
                if (ctx.globalCompositeOperation == "source-atop") ctx.globalCompositeOperation = "source-over";
                ctx.drawImage(this, 0, 0, w, h);
                if (black.length == 0 || black[0] == undefined || black[1] == undefined) return;
                //draw black cover
                var gri = ctx.createLinearGradient(0, h * black[0], 0, h * black[1]);
                gri.addColorStop(0, "black"); gri.addColorStop(1, "rgba(0,0,0,0)");
                ctx.fillStyle = gri;
                ctx.globalCompositeOperation = "source-atop";
                ctx.fillRect(0, 0, w, h * black[1]);
            }
        },
        drawImage: function (can, url, w, h, x, y) {
            var img = new Image();
            img.src = url;
            img.onload = function () {
                support.log(LogType.trace, true, `<DrawImage>url: ${this.src},imgW: ${this.width},imgH: ${this.height}`);
                var ctx = can.getContext("2d");
                ctx.clearRect(x, y, w, h);
                ctx.drawImage(img, x, y, w, h);
            }
        },
        getFont: function (size) {
            return size + "px Noto Sans S Chinese";
        },
        getLen: function (str, font, base = 0) {
            let arr = str.split('<br/>'), len = 0;
            for (let d of arr) {
                let s = d.replace(/\<.*?\>/g, "");
                let px = s.getPx(font);
                len += base ? Math.ceil(px / base) : px;
            }
            return len;
        },
        getUrl: function (n) {
            return n.replace(/^url\(["']|["']\)$/g, "")
        },
        getRGBA: function (c_r, c_g, c_b, c_a) {
            let d = [c_r, c_g, c_b, c_a];
            for (let i = 0; i < d.length; i++) {
                d[i] = Math.max(0, d[i]);
                if (d[i] <= 1) d[i] = parseInt(d[i] * 255);
                d[i] = d[i] / 255;
            }
            return `rgba(${d.join(",")})`;
        },
        /**向控制台输出一条带有时间信息的数据 
         * @function 向控制台输出信息
         * @description 向控制台输出一条带有时间信息的数据
         * @param msgs {String[]} 需要输出的消息
         * @param type {Number} 消息类型:Info=0,Debug=1,Warn=-1,Error=-2;Special color Info=2+
         * @param debug {Boolean} 是否只在debug状态下输出消息:true=仅在debug状态下输出消息
         * @return void
         * @author Krliov
        */
        log: function (type, debug, ...msgs) {
            if (debug && !system.debug) return;
            let t = new Date();
            let t_txt = t.getFullYear() + "-" + (t.getMonth() + 1) + "-" + t.getDate() + " " + t.getHours() + ":" + t.getMinutes() + ":" + t.getSeconds();
            let data = msgs.slice(1);
            data.unshift(t_txt);
            let LogType = $enum.log;
            switch (type) {
                case LogType.trace:
                    data.unshift("[%s][Trace]:" + msgs[0]);
                    console.log(...data);
                    break;
                case LogType.debug:
                    data.unshift("%c[%s][Debug]:" + msgs[0], "background-color:orange;");
                    console.debug(...data);
                    break;
                case LogType.info:
                    data.unshift("[%s][Info]:" + msgs[0]);
                    console.log(...data);
                    break;
                case LogType.warn:
                    data.unshift("[%s][Warn]:" + msgs[0]);
                    console.warn(...data);
                    break;
                case LogType.error:
                    data.unshift("[%s][Error]:" + msgs[0]);
                    console.error(...data);
                    break;
                case LogType.sp1:
                    data.unshift("%c[%s][Info]:" + msgs[0], "color:#0080ff");
                    console.log(...data);
                    break;
                case LogType.sp2:
                    data.unshift("%c[%s][Info]:" + msgs[0], "color:#0080ff");
                    console.log(...data);
                    break;
            }
        },
        removeComma: function (dat) {
            var i = dat.search(/,\s+\}$/);
            return i == -1 ? dat : dat.substring(0, i) + '}';
        },
    };
var data_cutin = {};
var data = {
	txt:[],
	audio:{},
	back:{},
	char:{},
	link:{},
	setting:{
		title:{},
		char:{},
		image:{},
		tween:{},
		override:{},
		disable:{prefix:{},title:{}},
		set(page,str){
			var self = this;
			return self.title[page] ? str.replace(page,self.title[page]) : str.replace('/BEG',' 行动前').replace('/END',' 行动后').replace('/NBT','');
		},
		check(sub,key,line){
			let ret = false;
			let self = this;
			line++;
			ret = self[sub] && self[sub][key] && self[sub][key][line] != undefined;
			if(ret) fun_msg(-1,false,`Line [${line}] data has been overrided.`);
			return ret;
		},
	},
	init(){
		let obj = document.getElementById("datas_override"),ride = this.setting;
		if(obj){
			let arr = obj.innerHTML.split('\n');
			for(let str of arr){
				if(str == "" || str.match("^\\s+$") || str.match("^\\s*//.*$")) continue;
				let match = str.match("^\\s*(.*?)\\:(.*)$");
				if(!match || !match[2]) continue;
				let m1 = match[1].toLowerCase(),m2 = match[2];
				switch(m1)
				{
					case 'title':
						{
							let [p,n] = m2.split('=');
							if(!n) continue;
							p = p.replace("_"," ");
							ride[m1][p] = n;
						}
						break;
					case 'char':
					case 'image':
					case 'tween':
						{
							/* d = data,v = value,p = page,l = line */
							let [d,v] = m2.split(';'),[p,l] = d.split(',');
							if(!v || !l) continue;
							p = p.replace("_"," ");
							let ls = l.split('.'),vs = v.split(',');
							let obj = {};
							if(!ride[m1][p]) ride[m1][p] = {};
							for(let vc of vs){
								let [k2,v2] = vc.split('=');
								obj[k2] = v2;
							}
							for(let lc of ls) ride[m1][p][lc] = obj;
						}
						break;
					case 'override':
						{
							let i = m2.indexOf(';');
							if(i == -1) continue;
							let d = m2.substring(0,i),v = m2.substring(i+1);
							let [p,l] = d.split(',');
							if(!l) continue;
							p = p.replace("_"," ");
							if(v == undefined) v = "";
							if(!ride[m1][p]) ride[m1][p] = {};
							ride[m1][p][l] = v;
						}
						break;
					case 'disable':
						{
							if(public_disabled) continue;
							let vs = m2.split(';');
							if(vs.length == 2 && vs[0] === "public"){
								system.disabled.note = arr[1];
								public_disabled = true;
							}
							/* t = type,p = target */
							let t = "",p = "";
							for(let vc of vs){
								let [k,v] = vc.split(':');
								if(!v) continue;
								switch(k){
									case "prefix":
									case "title":
										t = t || k;
										p = p || v;
										ride.disable[k][v] = "";
										break;
									case "note":
										if(t && p){
											ride.disable[t][p] = v;
										}
										break;
								}
							}
						}
						break;
				}
			}
			console.log(ride);
		}
		obj = document.getElementById("datas_txt");
		if(obj){
			this.txt = obj.textContent.split('\n');
			let m = this.txt[0].match(/\[header\((.*)\)/i);
			if(m){
				let set = m[1].toObject();
				if(set.is_prtswiki_only == "true") system.stats.log_all = false;
			}
		}
		obj = document.getElementById("datas_back");
		if(obj){
			for(let d of obj.innerHTML.split('\n')){
				let [k,v] = d.split(',');
				this.back[k] = v;
			}
		}
		obj = document.getElementById("datas_char");
		if(obj){
			for(let d of obj.innerHTML.split('\n')){
				let [k,v] = d.split(',');
				this.char[k] = v;
			}
		}
		obj = document.getElementById("datas_audio");
		if(obj){
			let str = obj.innerHTML.toLocaleLowerCase(),pos = str.search(/,\s+\}$/);
			if(pos != -1) {
				fun_msg(0,false,"The inner code has been executed.");
				str = str.substr(0,pos) + "}";/* 防止背刺 */
			}
			let dics = JSON.parse(str);
			for(let k in dics){
				if(dics[k].toString().indexOf("sound_beta_2") == -1) continue;
				this.audio[k] = dics[k].replace("sound_beta_2", system.assetUrl + "audio") + ".mp3";
			}
			this.audio["btn_click"] = system.sourceUrl + "music/general/g_ui/g_ui_btn_n.mp3";
		}
		obj = document.getElementById("datas_link");
		if(obj){
			this.link = JSON.parse(obj.innerHTML.toLowerCase());
		}
		let user = system.user;
		user.client = document.URL.includes("m.prts.wiki") ? "mobile" : "desktop";
		user.display = screen.availWidth * 0.7<screen.availHeight ? "vert" : "horiz";
		let tarStr = "firstHeading";
		let tarObj = document.getElementById(tarStr);
		system.page = tarObj.innerText;
		document.title = ride.set(system.page,document.title);
		tarObj.innerHTML = ride.set(system.page,system.page);
	}
}
data.init();
system.disabled.init();