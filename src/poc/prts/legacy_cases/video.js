case "video":

					{
						
let res = sets.res ? sets.res.toLowerCase() : \"\";
						if (!res) continue;
						assets.add(self.sourceUrl + res);
					}
					
break;

				default:
					
break;

			}
			continue;
		}
		else if (match[3]) {
			switch (match[3].toLowerCase()) {