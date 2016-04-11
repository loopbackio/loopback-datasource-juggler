function nearSearch(clause){

  Object.keys(clause).forEach(function (clauseKey) {
    if (Array.isArray(clause[clauseKey])){
      clause[clauseKey].forEach(function (el) {
        var ret = nearSearch(el);
        if (ret) return ret;
      });
    } else {
      if (clause[clauseKey].hasOwnProperty('near')){
        if(nearResults.length > 0){
          throw new Error('Cannot use multiple "near" clauses in query');
        } else {
          var result = clause[clauseKey];
          nearResults.push({
            near: result.near,
            maxDistance: result.maxDistance,
            unit: result.unit,
            key: clauseKey
          });
        }
      }
    }    
  });
}



var badClause = {or: [{location: {near: "29,-90"}},{location: {near: "50,-72"}}]};
var nearResults = [];

try{
  nearSearch(badClause);
  console.log(nearResults);
} catch (e){
  console.log('BadClause returned:' + e);
}

nearResults = [];
var good1DepthClause = {or: [{location: {near: "29,-90"}},{value: {like: "x"}},{popular: true}]};
try{
  nearSearch(good1DepthClause);
  console.log(nearResults);
} catch (e){
  console.log('good1DepthClause returned:' + e);
}


nearResults = [];
var good2DepthClause = {or: [{location: "29,-90"},{value: {like: "x"}},{and: [{name: 'jack'}, {coords: {near: "29,-90"}}]}]};
try{
  nearSearch(good2DepthClause);
  console.log(nearResults);
} catch (e){
  console.log('good2DepthClause returned:' + e);
}
