"use strict";
Array.prototype.empty = function () { return this.length == 0; }
Array.prototype.getSum = function () { var s = 0; for (var i = 0; i < this.length; i++) s += +this[i]; return s; }
Array.prototype.last = function () { return this.empty() ? undefined : this[this.length - 1]; }
Array.prototype.removeEmpty = function () { for (var i = 0; i < this.length; i++) if (this[i] == undefined) this.splice(i--, 1); }
HTMLAudioElement.prototype.reset = function () { this.pause(); this.onended = ""; this.loop = false; this.src = ""; }
HTMLAudioElement.prototype.dispose = function () { this.reset(); this.remove(); }
HTMLAudioElement.prototype.fade = function (duration, v_end = 0, isremove = false) {
    v_end = Math.clamp(v_end, 0, 1);
    if (isremove) {
        this.id = "";
        this.className = "";
    }
    let id_old = +this.getAttribute("v-id");
    if (id_old) {
        clearInterval(id_old);
    }
    this.setAttribute("v-fade", (this.volume - v_end) / duration / 50);
    this.setAttribute("v-end", v_end);
    var id = setInterval(function () {
        var b = arguments[0];
        var v = +b.getAttribute("v-end") || 0, f = +b.getAttribute("v-fade") || 0.1;
        if ((f > 0 && b.volume <= v) || (f < 0 && b.volume >= v) || f == 0) { b.volume = v; clearInterval(+b.getAttribute("v-id")); if (b.getAttribute("v-remove") == "true") b.remove(); else { b.removeAttribute("v-id"); b.removeAttribute("v-fade"); b.removeAttribute("v-end"); b.removeAttribute("v-remove"); } return; }
        b.volume = Math.clamp(b.volume - f, 0, 1);
    }, 20, this);
    this.setAttribute("v-id", id);
    this.setAttribute("v-remove", isremove);
}
HTMLElement.prototype.fadeIn = function (duration) {
    var self = this;
    if (!self) return;
    var a_beg = self.style.opacity || (self.style.display == "none" ? 0 : 1);
    if (Number.isNaN(+duration) || a_beg === 1) {
        self.style.opacity = "";
        self.show();
        return;
    }
    var a_step = (1 - a_beg) / (+duration * 100);
    var id_old = self.getAttribute("v-id");
    if (id_old) {
        clearInterval(+id_old);
    }
    var timer = setInterval(() => {
        var a = self.style.opacity;
        a = a + a_step;
        if (a >= 0) {
            var id = self.getAttribute("v-id");
            clearInterval(+id);
            self.style.opacity = "";
            self.show();
            return;
        }
        self.style.opacity = a;
    }, 10);
    self.setAttribute("v-id", timer);
    self.style.display = "";
    self.style.opacity = a_beg;
}
HTMLElement.prototype.fadeOut = function (duration, args) {
    var self = this, args = args || {};
    if (!self) return;
    var a_beg = self.style.opacity || (self.style.display == "none" ? 0 : 1);
    if (Number.isNaN(+duration) || a_beg === 0) {
        self.style.opacity = "";
        self.hide();
        return;
    }
    var a_step = a_beg / (+duration * 100);
    var id_old = self.getAttribute("v-id");
    if (id_old) {
        clearInterval(+id_old);
    }
    if (args.remove) self.setAttribute("v-remove", "1");
    var timer = setInterval(function () {
        let obj = arguments[0];
        var a = obj.style.opacity;
        a = a - a_step;
        if (a > 0) {
            obj.style.opacity = a;
            return;
        }
        var id = obj.getAttribute("v-id");
        clearInterval(id);
        if (obj.getAttribute("v-remove")) {
            obj.remove();
            return;
        }
        obj.style.opacity = "";
        obj.hide();
    }, 10, self);
    self.setAttribute("v-id", timer);
}
HTMLElement.prototype.hide = function () { if (!this) return; this.style.display = "none"; }
HTMLElement.prototype.show = function () { if (!this) return; this.style.display = "block"; }
HTMLElement.prototype.setClear = function () { if (!this) return; this.innerHTML = ""; }
HTMLElement.prototype.setHide = function () { if (!this) return; this.classList.add("hidden"); }
HTMLElement.prototype.setShow = function () { if (!this) return; this.classList.remove("hidden"); }
Math.clamp = function (v, l, r) { return v < l ? l : v > r ? r : v; }
String.prototype.getValue = function (sep = ':') { var p = this.lastIndexOf(sep); if (p == -1) return ""; return this.substr(p + sep.length); }
String.prototype.getKey = function (sep = ':') { var p = this.lastIndexOf(sep); if (p == -1) return this; return this.substr(0, p); }
String.prototype.getPx = function (font) { var canvas = document.createElement("canvas"), context = canvas.getContext("2d"); context.font = font; return context.measureText(this).width; }
String.prototype.toObject = function (sep1 = ",", sep2 = "=", tolower = true) {
    var regStr = `\\s*(.*?)\\s*${sep2}\\s*(?:[\'"](.*?)[\'"]|([\\w.-]+))\\s*${sep1}?`;
    var reg = new RegExp(regStr, 'g');
    var ms;
    try {
        ms = this.matchAll(reg);
    }
    catch {
        let arr;
        ms = [];
        while ((arr = reg.exec(this) != null)) ms.push(arr);
    }
    var o = {};
    for (var m of ms) {
        var p = m[1], v = m[2] === undefined ? m[3] : m[2];
        if (tolower) p = p.toLowerCase();
        o[p] = v;
    }
    if (Object.keys(o).length == 0) {
        var m = this.match(regStr);
        if (m) {
            var p = m[1], v = m[2] === undefined ? m[3] : m[2];
            if (tolower) p = p.toLowerCase();
            o[p] = v;
        }
    }
    return o;
}
String.prototype.toArray = function (sep) { return this.replace(/\r/g, "").split(sep); }
class TimerManager {
    constructor() {
        this.list = {};
    }
    /**
     * n=name,f=function,t=delay,p=isinterval
     * @param {string} n 名称，即标识符
     * @param {function} f 需要执行的函数体
     * @param {number} t 等待时间/循环时间
     * @param {boolean} p 是否为循环的定时器
     * @return {boolean} 创建成功返回true，否则为false
     **/
    create(n, f, t = 1000, p = false) {
        var obj = {}, self = this;
        self.clear(n, true);
        if (typeof (n) !== "string" || typeof (f) !== 'function' || Number.isNaN(+t))
            return false;
        obj.delegate = f;
        obj.interval = p;
        if (p) {
            obj.id = setInterval(function () {
                obj.delegate();
            }, +t);
        }
        else {
            obj.trigger = false;
            obj.id = setTimeout(function () {
                obj.delegate();
                obj.trigger = true;
                self.clear(n);
            }, +t);
        }
        self.list[n] = obj;
        return true;
    }
    /**
     * @param {string} n 名称，标识符
     * @param {boolean} s 是否需要在移除时执行未执行的函数
     * @return {boolean} 移除成功返回true，否则为false
     **/
    clear(n, s = false) {
        var self = this;
        if (!self.isTimer(n))
            return false;
        let o = self.list[n];
        if (s && !o.trigger && typeof (o.delegate) === "function") {
            o.delegate();
        }
        if (o.id) {
            if (o.interval)
                clearInterval(o.id);
            else
                clearTimeout(o.id);
        }
        delete self.list[n];
        return true;
    }
    clearAll() {
        var self = this;
        for (var n in self.list) {
            var o = self.list[n];
            if (o.interval)
                clearInterval(o.id);
            else
                clearTimeout(o.id);
        }
        self.list = {};
    }
    /**
     * @param {string} n 名称,标识符
     * @return {boolean} 存在时返回true，否则为false
    **/
    hasTimer(n) {
        var self = this;
        return self.list[n];
    }
    /**
     * @param {string} n 名称,标识符
     * @return {boolean} 为Timer时返回true，否则为false
    **/
    isTimer(n) {
        var self = this;
        return self.hasTimer(n) && !self.isFake(n);
    }
    /**
     * @param {string} n 名称,标识符
     * @return {boolean} 设定成功后返回true，否则为false
    **/
    setFake(n) {
        var self = this;
        if (self.isTimer(n))
            return false;
        self.list[n] = -1;
        return true;
    }
    /**
     * @param {string} n 名称,标识符
     * @return {boolean} 移除成功后返回true，否则为false
    **/
    removeFake(n) {
        var self = this;
        if (!self.isFake(n))
            return false;
        delete self.list[n];
        return true;
    }
    /**
     * @param {string} n 名称,标识符
     * @return {boolean} 确定为伪造的timer时返回true，否则为false
    **/
    isFake(n) {
        var self = this;
        return self.list[n] === -1;
    }
}
class CookieManager {
    constructor() { }
    /**
     * Set Cookie Method
     * @param {string} name The name of cookie need to set.
     * @param {string} value cookie value.
     * @param {*} options The options of this cookie.such as domain and path.
     */
    Set(name, value, options) {
        var t = new Date();
        var m = options.expires ? options.expires.match(/^(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i) : [];
        var res = [];
        if (m) {
            t.setTime(t.getTime() + (((((m[1] || 0) * 24 + (m[2] || 0) * 1) * 60 + (m[3] || 0) * 1) * 60 + (m[4] || 0) * 1) * 1000));
            res.push("expire=" + t.toUTCString());
            fun_msg(3, false, "cool down: " + t.toUTCString());
        }
        if (options.path) {
            res.push("path=" + options.path);
        }
        if (options.domain) {
            res.push("domain=" + options.domain);
        }
        document.cookie = name + "=" + value + ";" + res.join(";");
    }
    /**
     * Get Cookie Method
     * @param {string} name The name of cookie need to get.
     * @returns If the specific cookie name exist,return the value,else return null.
     */
    Get(name) {
        var cook = document.cookie;
        var arr = cook.split(';');
        for (var d of arr) {
            var str = d.trim();
            if (str.startsWith(name + "=")) {
                return str.substring(name.length + 1);
            }
        }
        return null;
    }
    /**
     * Remove Cookie Method
     * @param {string} name The name of cookie need to remove.
     * @param {*} options The options of the cookie.such as domain and path.
     */
    Remove(name, options) {
        var res = ["expires=Thu, 01 Jan 1970 00:00:00 GMT"];
        if (options.path) {
            res.push("path=" + options.path);
        }
        if (options.domain) {
            res.push("domain=" + options.domain);
        }
        document.cookie = name + "=" + ";" + res.join(";");
    }
}
