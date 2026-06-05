	// 移除 MediaWiki 延迟执行队列的壳子
	$(document).ready(()=>{
		$(document).on('webkitfullscreenchange mozfullscreenchange fullscreenchange', function() {
			fun_fullscreen();
		});
		$("#button_fullscreen").click(function() {
			txt_fullscreen();
		});
		let name = mw.config.get("wgUserName");
		system.user.name = name ? name.replace(/[Dd][Rr]\./,"") : "博士";
		try{
			fun_sys_preload();
		}
		catch(err){
			document.getElementById("dialog_output").innerHTML = "数据载入异常。请尝试刷新页面或是提交异常反馈。"
			system.error.type = "preload_error";
			system.error.info = err.toString();
			system.error.stat = true;
		}
	});

	$.prototype.fadeToExit = function(duration, easing){
		if(!duration){
			return this.remove();
		}
		return this.fadeOut(duration,easing,function(){this.remove()});
	};

	(function(ev){
		var logAll = document.getElementById("button_playback_all"),txt = document.getElementById("dialog_output");
		if(!system.error.stat && system.stats.log_all) logAll.setShow();
		if(fun_fullscreen_support()) document.getElementById("button_fullscreen").setShow();
		if(public_disabled || system.disabled.flag){
			let r = system.disabled.note;
			txt.innerHTML = (public_disabled ? "剧情模拟器已被全局停用" : "该页面的剧情模拟器已被停用") + "，查看剧情所有文本请单击LOG ALL" + (r ? "<br/>附言: " + r : "");
			document.getElementById("button_auto").setHide();
			document.getElementById("button_reset").setHide();
			document.getElementById("button_playback").setHide();
			logAll.setShow();
			logAll.style.left = "24px";
			return;
		}
		if(system.user.client == "desktop")
			document.getElementById("button_report").setShow();

		if(system.error.stat)
			return;

		var txt = document.getElementById("dialog_output");
		txt.innerHTML = "页面已加载完毕。为避免意外的数据消耗，剧情资源仅在长按1s后开始预载。如果您仅需浏览纯文本内容，请直接单击LOG ALL";
		system.preload.init();
	})();
	fun_sys_init();