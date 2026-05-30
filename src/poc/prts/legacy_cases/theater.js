case "theater":

				{
					
let mode = cmd_set.mode || \"false\";
					
let btn1 = document.getElementById(\"button_playback\"),btn2 = document.getElementById(\"button_auto\");
					if(mode == \"true\"){
						if(btn1.classList.contains(\"return\")) txt_playback(\"sys_playback\",\"button_playback\");/* 闃叉鏋侀檺鎯呭喌涓嬪鑷寸殑bug */
						system.flag.skip = 0;/* 寮哄埗鍋滄skip妯″紡 */
						btn1.setHide();
						btn2.setHide();
						timer.setFake(\"auto\");
						system.stats.theater = true;
					}
					else{
						btn1.setShow();
						btn2.setShow();
						timer.removeFake(\"auto\");
						system.stats.theater = false;
					}
				}
				
break;