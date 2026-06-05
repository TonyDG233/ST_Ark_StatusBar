function Timer(){this.list = {};}
	/**
	 * n=name,f=function,t=delay,p=isinterval
	 * @param {string} n 名称，即标识符
	 * @param {function} f 需要执行的函数体
	 * @param {number} t 等待时间/循环时间
	 * @param {boolean} p 是否为循环的定时器
	 * @return {boolean} 创建成功返回true，否则为false
	*/
	Timer.prototype.create = function(n,f,t=1000,p=false)
	{
		var obj = {},self = this;
        self.clear(n,true);
    	if(typeof(n) !== "string" || typeof(f) !== 'function' || Number.isNaN(+t)) return false;
    	obj.delegate = f;
    	obj.interval = p;
    	if(p){
    		obj.id = setInterval(function(){
            	obj.delegate();
        	},+t);
        }
        else{
        	obj.trigger = false;
        	obj.id = setTimeout(function(){
                obj.delegate();
				obj.trigger = true;
                self.clear(n);
            },+t);
        }
        self.list[n] = obj;
        return true;
	}
	/**
	 * @param {string} n 名称，标识符
	 * @param {boolean} s 是否需要在移除时执行未执行的函数
	 * @return {boolean} 移除成功返回true，否���为false
	*/
	Timer.prototype.clear = function(n,s = false)
	{
		var self = this;
		if(!self.isTimer(n)) return false;
	    let o = self.list[n];
	    if(s && !o.trigger && typeof(o.delegate) === "function"){
	        o.delegate();
	    }
		if(o.id){
			if(o.interval) clearInterval(o.id);
			else clearTimeout(o.id);
		}
	    delete self.list[n];
	    return true;
	}
	Timer.prototype.clearAll = function () {
		var self = this;
		for(var n in self.list)
		{
			var o = self.list[n];
			if(o.interval) clearInterval(o.id);
			else clearTimeout(o.id);
		}
		self.list = {};
	}
	/**
	 * @param {string} n 名称,标识符
	 * @return {boolean} 存在时返回true，否则为false
	*/
	Timer.prototype.hasTimer = function (n) {
		var self = this;
		return self.list[n];
	}
	/**
	 * @param {string} n 名称,标识符
	 * @return {boolean} 为Timer时返回true，否则为false
	*/
	Timer.prototype.isTimer = function (n) {
		var self = this;
		return self.hasTimer(n) && !self.isFake(n);
	}
	/**
	 * @param {string} n 名称,标识符
	 * @return {boolean} 设定成功后返回true，否则为false
	*/
	Timer.prototype.setFake = function (n) {
		var self = this;
		if(self.isTimer(n)) return false;
		self.list[n] = -1;
		return true;
	}
	/**
	 * @param {string} n 名称,标识符
	 * @return {boolean} 移除成功后返回true，否则为false
	*/
	Timer.prototype.removeFake = function (n) {
		var self = this;
		if(!self.isFake(n)) return false;
		delete self.list[n];
		return true;
	}
	/**
	 * @param {string} n 名称,标识符
	 * @return {boolean} 确定为伪造的timer时返回true，否则为false
	*/
	Timer.prototype.isFake = function (n) {
		var self = this;
		return self.list[n] === -1;
	}
	function DeepCopy(k){
		function arrCopy(k2){
			var arr = [];
			for(var e of k2) arr.push(typeof e === "object" ? DeepCopy(e) : e);
			return arr;
		}
		function objCopy(k2){
			var obj = {};
			for(var d of Object.entries(k2)) obj[d[0]] = typeof d[1] === "object" ? DeepCopy(d) : d[1];
			return obj;
		}
		return Array.isArray(k) ? arrCopy(k) : objCopy(k);
	}
	function SetCookie(name,value,options){
		var t = new Date();
		var m = options.expires ? options.expires.match(/^(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i) : [];
		var res = [];
		if(m){
			t.setTime(t.getTime()+(((((m[1] || 0)*24+(m[2] || 0)*1)*60+(m[3] || 0)*1)*60+(m[4] || 0)*1)*1000));
			res.push("expire="+t.toUTCString());
			fun_msg(3,false,"cool down: "+t.toUTCString());
		}
		if(options.path){
			res.push("path="+options.path);
		}
		if(options.domain){
			res.push("domain="+options.domain);
		}
		document.cookie = name + "=" + value + ";" + res.join(";");
	}
	function GetCookie(name){
		var cook = document.cookie;
		var arr = cook.split(';');
		for(var d of arr){
			var str = d.trim();
			if(str.startsWith(name)){
				return str.substring(name.length+1);
			}
		}
		return null;
	}
	function RemoveCookie(name,options){
		var res = ["expires=Thu, 01 Jan 1970 00:00:00 GMT"];
		if(options.path){
			res.push("path="+options.path);
		}
		if(options.domain){
			res.push("domain="+options.domain);
		}
		document.cookie = name + "=" + ";" + res.join(";");
	}