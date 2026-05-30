case "@pa":

				log = document.getElementById(\"playback_all_result\");
				
break;

		}
	}

	if (name.trim()) {
		
let em = document.createElement(\"em\");
		group.append(em);
		em.innerHTML = name;
		if (support.getLen(name, support.getFont(16)) > log_em_limit_px) em.style.fontSize = \"12px\";
		if (pas.color) em.style.color = pas.color;
	}

	
let span = document.createElement(\"span\");
	span.innerHTML = scenario.extend.formatTxt(text).replace(/\\<(?!br).*?\\>/g, \"\");
	group.append(span);
	if (log) log.append(group);
}
function fun_setting(key)
{
	
switch (key) {

		case \"pre\":
			{
				if (system.debug) system.txt.max = data.txt.length;
				else if(system.txt.max == 0) system.txt.max = data.txt.length;
				fun_msg(1,true,\"<Txt>max: \"+system.txt.max);
				system.stats.reset = true;
				
var eles = document.getElementsByClassName(\"dialog_style header\");
				if(eles){
					eles[0].setAttribute(\"d-max\",system.txt.max);
				}
				document.getElementById(\"dialog_name\").setClear();
				document.getElementById(\"dialog_output\").setClear();
				document.getElementById(\"playback_result\").setClear();
				document.getElementById(\"sys_dialog\").hide();
				document.getElementById(\"button_reset\").classList.remove(\"forbid\");
				document.getElementById(\"sys_blocker\").style.backgroundColor = \"rgba(0,0,0,0)\";
			}
			
break;

		case \"reset\":
			{
				fun_stop_audio(\"@all\");
				timer.clearAll();
				document.getElementById(\"sys_video\").setClear();
				document.getElementById(\"sys_subtitle\").setClear();
				document.getElementById(\"sys_back\").setClear();
				document.getElementById(\"sys_image\").setClear();
				document.getElementById(\"sys_char\").setClear();
				document.getElementById(\"sys_item\").setClear();
				document.getElementById(\"sys_cutin\").setClear();
				document.getElementById(\"sys_decision\").setHide();
				document.getElementById(\"sys_camera\").style = \"\";
				document.getElementById(\"sys_blocker\").style = \"\";
				document.getElementById(\"dialog_name\").style = \"\";
				document.getElementById(\"dialog_name\").innerHTML = \"鍓ф儏妯℃嫙鍣╘";
				document.getElementById(\"sys_dialog\").show();
				system.stats.reset = false;
				system.multi.reset();
				if(system.stats.theater){
					system.stats.theater = false;
					document.getElementById(\"button_playback\").setShow();
					document.getElementById(\"button_auto\").setShow();
				}
				if(system.skipnode.stat){
					system.skipnode.stat = false;
					system.ui.applySkipNode();
				}
				fun_setting(\"cmd_open\");
				document.getElementById(\"button_reset\").classList.add(\"forbid\");
				system.txt.index = 0;system.txt.dynamic = null;system.flag.respond = 0;
			}
			
break;

		case \"cmd_suspend\":
			system.flag.respond++;
		case \"cmd_close\":
			system.stats.click = false;
			
break;

		case \"cmd_resume\":
			system.flag.respond--;
		case \"cmd_open\":
			system.stats.click = true;
			
break;

	}
}
function fun_stop_audio(key,args)
{
	
let pas = args || { time: 0.5 };
	if (!key.startsWith(\"@\")) {
		
let tar = document.getElementById(key);
		if (tar) tar.fade(pas.time, 0, true);
		return;
	}
	
switch (key) {

		case \"@all\":
			{
				
let tars = document.getElementById(\"sys_audio\").children;
				for (
let tar of tars) {
					tar.fade(1, 0, true);
				}
			}
			
break;

		case \"@music\":
			{
				
let tar = document.getElementById(\"sys_music\");
				if (tar) tar.fade(pas.time, 0, true);
			}
			
break;

		case \"@sound\":
			{
				
let tars = document.getElementById(\"sys_audio\").querySelectorAll(\".playsound\");
				for (
let tar of tars) {
					tar.fade(pas.time, 0, true);
				}
			}
			
break;

	}
}
function fun_skip_start()
{
	if(!system || system.stats.theater || system.txt.max == 0 || system.flag.respond > 0) 
return 0;
	if(timer.hasTimer(\"skip\")) fun_skip_stop();/* 闃叉鎰忓瀵艰嚧鐨勫姞閫熸棤娉曞仠姝?*/
	timer.create(\"skip\",()=>{
		if(++system.flag.skip >= wait_trigger){
			if(system.stats.auto) fun_auto_stop();
			timer.clear(\"skip\");
			timer.setFake(\"auto\");
			txt_next();
		}
	},10,true);
}
function fun_skip_stop()
{
	if(!system) return;
	if(system.flag.skip == wait_trigger){
		timer.removeFake(\"auto\");
		timer.create(\"click_block\",function(){},100);
	}
	else timer.clear(\"skip\");
	system.flag.skip = 0;
}

function fun_txt_format(key_txt) {

	
let t = key_txt.trim();
	t = t.replace(/{@nickname}/ig,system.user.name);
	t = t.replace(/{@nbs}/ig,\" \");
	try{
		t = t.replaceAll(\"<color=\",\"<font color=\").replaceAll(\"</color>\",\"</font>\");
		t = t.replaceAll(\"{@s}\",\"\").replaceAll(\"\\\
\",\"<br/>\");
	}
	catch(err){
		fun_msg(-1,false,\"This browser not support replaceAll function.\");
		t = t.replace(/<color=/ig,\"<font color=\").replace(/<\\/color>/ig,\"</font>\");
		t = t.replace(/{@s}/ig,\"\");
		t = t.replace(/\\\
/g,\"<br/>\");
	}
	
return t;
}

function fun_report_to_developer(note) {

	if(!mw.config.values.wgUserGroups.includes(\"user\") || GetCookie(\"ak_scerp_cd\")) return;
	
var api = new mw.Api();
	
var btn_sub = document.getElementById(\"report_submit\");
	api.get({action:'query',meta:'tokens',type:'csrf'}).done((ret)=>{
		if(ret.error || ret.warning){
			fun_msg(-2,false,\"get token failed.\");
			btn_sub.disabled = false;
			btn_sub.classList.remove(\"waiting\");
			return;
		}
		
var dat = `*Time: ${new Date().toLocaleString()}\
*Note: ${note}`;
		if(system.error.stat) dat = `${dat}\
*error: ${system.error.info}\
**client: ${system.user.client} | screen: ${system.user.display}`;
		dat = `${dat}\
*index: ${system.txt.index} | debug: ${system.debug}\
*UserAgent: ${navigator.userAgent}\
*Reporter: ${system.user.name}`;
		
var token = ret.query.tokens.csrftoken.toString();
		
var param = {
			action: \"edit\",
			title: \"鍓ф儏涓€瑙?Auto_Report_List\",
			section: \"new\",
			sectiontitle: \"[[\"+system.page+\"]]\",
			bot: true,
			watchlist: 'nochange',
			text: dat,
			summary: \"Append by ScenarioSimulator Auto Report Script.\",
			token: token,
		};
		api.post(param).done((ret)=>{
			console.log(ret);
			btn_sub.disabled = false;
			btn_sub.classList.remove(\"waiting\");
			if(ret.error){
				fun_msg(-2,false,\"Report Error.\",ret);
				return;
			}
			fun_msg(3,false,\"Report Success!\");
			if(!mw.config.values.wgUserGroups.includes(\"sysop\")) SetCookie(\"ak_scerp_cd\",\"yes\",{path:'/',domain:'.prts.wiki',expires:'5m'});
			mw.notify(\"鎻愪氦瀹屾垚锛乗");
			btn_sub.parentElement.classList.add(\"hidden\");
		});
	});
}

function fun_report_toggle() {

	
let report = document.getElementById(\"button_report\");
	if(!report || !report.childElementCount) return;
	
let ui = report.children[0];
	if(ui.classList.contains(\"hidden\")){
		system.stats.report = true;
		fun_setting(\"cmd_suspend\");
		
var dat = \"*index: \"+system.txt.index+\"\
*UserAgent: \"+navigator.userAgent+\"\
*ID: \"+system.user.name;
		if(system.error.stat) dat = \"*error: \"+system.error.info + \"\
\" + dat;
		document.getElementById(\"report_collected\").value = dat;
		document.getElementById(\"report_note\").value = \"\";
		ui.classList.remove(\"hidden\");
	}
	else{
		ui.classList.add(\"hidden\");
		fun_setting(\"cmd_resume\");
		system.stats.report = false;
	}
}

function fun_sys_init() {

	
let report = document.getElementById(\"button_report\");
	document.getElementById(\"button_playback\").addEventListener(\"click\",()=>{
		txt_playback(\"sys_playback\",\"button_playback\");
	});
	document.getElementById(\"button_playback_all\").addEventListener(\"click\",()=>{
		txt_playback(\"sys_playback_all\",\"button_playback_all\",true);
	});
	if(report){
		report.addEventListener(\"click\", function(event){
			if(event.defaultPrevented) return;
			fun_report_toggle();
		});
		for(
var ele of report.children){
			ele.addEventListener(\"click\",function(e){
				e.preventDefault();
			});
		}
		document.getElementById(\"report_submit\").addEventListener(\"click\",function(e){
			if(!mw.config.values.wgUserGroups.includes(\"user\")){
				mw.notify(\"鎮ㄩ渶瑕佺櫥褰曞悗鎵嶈兘浣跨敤姝ゅ姛鑳絶\");
				return;
			}
			if(GetCookie(\"ak_scerp_cd\")){
				mw.notify(\"鎮ㄥ湪鐭椂闂村唴宸茬粡鎶ュ憡杩囦簡锛岃5鍒嗛挓鍚庡啀璇曞惂~\");
				return;
			}
			
var note = document.getElementById(\"report_note\");
			if(!note.value.trim()){
				mw.notify(\"璇峰～鍐欎笂鐩稿叧澶囨敞淇℃伅~\");
				return;
			}
			this.disabled = true;
			this.classList.add(\"waiting\");
			fun_report_to_developer(note.value);
			e.preventDefault();
		});
		document.getElementById(\"report_cancel\").addEventListener(\"click\",function(e){
			fun_report_toggle();
			e.preventDefault();
		});
	}
}

function fun_serialize_object(header,obj) {

	
var res = [];
	for(
var [k,v] of Object.entries(obj)){
		if(v == undefined) continue;
		res.push(`${k}=\"${v}\"`);
	}
	
return `[${header}(${res.join(', ')})]`;
}

function fun_sys_preload() {

	
let page = system.page;
	
let assets = new Set();
	
var exFun = scenario.extend, regexStr = scenario.regex;
	
let logs = {
		now: \"\", name: \"\", multi: false, deci: false, first: null, node: null, options: [], stacks: [],
		multiID: \"\",
		init() {
			
var self = this;
			self.multiEnd();
			self.deciEnd();
		},
		multiBegin(id) {
			
var self = this;
			self.multi = true;
			self.multiID = id || \"\";
		},
		multiEnd() {
			
var self = this;
			self.multi = false;
			self.multiID = \"\";
			self.name = \"\";
			self.now = \"\";
		},
		deciBegin(node) {
			
var self = this;
			self.deci = true;
			self.first = node;
			self.node = node;
		},
		deciAppend(node) {
			
var self = this;
			self.node.append(node);
			self.node = node;
		},
		deciPop() {
			
var self = this;
			self.stacks.pop();
			
var obj = self.stacks.last();
			if (obj) self.node = obj.self;
			
return obj;
		},
		deciPush(node, arr) {
			
var self = this;
			self.stacks.push({ self: node, values: arr, selected: new Set() });
		},
		deciEnd() {
			
var self = this;
			self.deci = false;
			self.first = null;
			self.options = [];
			self.stacks = [];
		},
		getRecordPara(args) {
			
var self = this;
			
return {
				name: self.name,
				text: self.now,
				mode: self.deci,
				target: self.node,
			};
		},
	};
	
let txts = data.txt, imgs = data.back, chars = data.char, cfgs = data.setting;
	for (
let i = 0; i < txts.length; i++) {
		if (cfgs.check('override', page, i)) txts[i] = cfgs.override[page][i + 1];
		
let txt = txts[i];
		if (!txt || txt.match(regexStr.space) || txt.match(regexStr.comment)) continue;
		
let match = txt.match(regexStr.command);
		if (match == null) {
			if (logs.multi) {
				fun_playback(\"@pa\", logs.getRecordPara());
				logs.multiEnd();
			}

			logs.name = \"\";
			logs.now = txt;
			fun_playback(\"@pa\", logs.getRecordPara());
			continue;
		};

		support.log(LogType.debug, true, `[Pre]Ready to analyze Line [${i + 1}]`);
		if (match[1] != undefined) {
			
let m1 = match[1].toLowerCase(), sets = match[2].toObject();
			
switch (m1) {

				case \"animtext\":
					{
						if (!match[5])
							continue;

						
let mc = match[5].matchAll(regexStr.animatepara);
						
let arr = [];
						for (
let m of mc) {
							arr.push(m[2]);
						}

						if (arr.length == 0)
							continue;

						
let text = arr.join(\"<br/>\");
						logs.name = \"\";
						logs.now = text;
						fun_playback(\"@pa\", logs.getRecordPara());
					}
					
break;