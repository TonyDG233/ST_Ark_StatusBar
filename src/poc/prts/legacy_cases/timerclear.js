case "timerclear":

				{
					
let span = document.getElementById(\"sticker_timer\");
					if(!span) 
return -1;
					$(span).css(\"opacity\",cmd_set.afrom || 1).fadeTo(cmd_set.duration*1000 || 0,cmd_set.ato || 0);
					timer.clear(\"sticker_timer\");
				}
				
break;