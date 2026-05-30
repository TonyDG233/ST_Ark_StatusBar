case "stopsound":

				{
					
let id = m1 === \"stopmusic\" ? \"@music\" : (sets.channel && \"audio_\" + sets.channel) || \"@sound\";
					fun_stop_audio(id, { time: sets.fadetime || 1 });
				}
				
break;