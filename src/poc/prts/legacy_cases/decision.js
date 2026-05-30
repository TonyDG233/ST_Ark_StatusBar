case "decision":

					{
						
let ops = sets.options ? exFun.formatTxt(sets.options).split(';') : [];
						
let vas = sets.values ? sets.values.split(';') : [];
						if (!ops || !vas) continue;
						
let panel = document.createElement('div');
						panel.classList.add(\"decision\");
						
let group = document.createElement(\"li\");
						group.classList.add(\"decision\");
						for (
let i = 0; i < ops.length; i++) {
							logs.options[vas[i]] = ops[i];
							
let span = document.createElement(\"span\");
							span.classList.add(\"decision\");
							span.innerHTML = `銆?{ops[i]}銆慲;
							group.append(span);
						}
						group.style.height = `${ops.length * 22}px`;
						panel.append(group);
						if (logs.deci) {
							logs.deciAppend(panel);
						}
						else {
							logs.deciBegin(panel);
						}
						logs.deciPush(panel, vas);
					}
					
break;