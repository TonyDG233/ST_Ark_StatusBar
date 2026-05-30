case "skipnode":

				{
					
var node = system.skipnode;
					
switch (sets.mode) {

						case \"nofirstskip\":
							node.stat = true;
							
break;

						case \"skip\":
							node.stat = false;
							
break;

						default:
							
return -1;
					}

					system.ui.applySkipNode();
				}
				
break;