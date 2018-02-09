function log(s) {
	if (console) console.log(s);
}
function tr(s) {
	return $.trim(s.replace(/\t+/, ' '));
}

var demoCSS;
$(document).ready(function() {
	$('#input, #variables').on('input propertychange', parseInput);
	$('.radio label,.checkbox label').click(parseInput);

	var demoURL='css/demo.css';
	$.get(demoURL, function(val) {
		demoCSS=val;
		$('.btn.demo').click(function() {
			$('#input').val(demoCSS);
			$('#variables').val('@red:#f00;\n@border:solid 1px #f00;\n//sass and stylus syntax are supported too');
			parseInput();
		});
	});

	$('.select').click(function() {
		$('#output').select();
	});
});

var indentS;
var openingBracket;
var closingBracket;
var semiColumn;
var eol;
var keepOutsideComments;
var keepinsideComments;
var removeHacks;
var vars = {};
var comments = {};
var dataURLs = {};

function trimColor(str){
	return str.replace(/#([0-9a-f]{3}|[0-9a-f]{6})\b/ig, function (a) {
		return a.toLowerCase()
	})
}

function parseVars () {
	vars = {};
	variables = $('#variables').val().split(/[\n;]/);
	$(variables).each(function(){
		var pair = this.replace(/\/\*[\s\S]*?\*\//gm,'')
		.replace(/\/\/[\s\S]*$/gm,'');

		pair = pair.split(/[:=]/);
		if(pair.length > 1){
			vars[trimColor($.trim(pair[1]))] = $.trim(pair[0]);
		}
	})
}

function parseInput() {
	var langVal=$('input:radio[name=lang]:checked').val();
	if (langVal=='less') {
		eol=';';
		openingBracket='{';
		closingBracket='}';
		semiColumn=':';
	} else if (langVal=='sass') {
		eol=';';
		openingBracket='{';
		closingBracket='}';
		semiColumn=':';
	} else if (langVal=='stylus') {
		eol='';
		openingBracket='';
		closingBracket='';
		semiColumn='';
	}
	parseVars();
	var indentVal=$('input:radio[name=indent]:checked').val();
	if (indentVal=='indentt') indentS='\t';
	else if (indentVal=='indent2') indentS='  ';
	else if (indentVal=='indent4') indentS='    ';

	keepOutsideComments = $('[name=outside]').prop('checked');
	keepInsideComments = $('[name=inside]').prop('checked');
	removeHacks = $('[name=removeHacks]').prop('checked');

	$('#output').val(parseCSS($('#input').val()));
}

function makeMark (num) {
	var str="";
	str += '\t\t\t\t\t\t\t\t\t\t\t';
	while (num--){
		str += ' '
	}
	str += '\t\t\t\t\t\t\t\t\t\t\t';
	return str
}

function decodeMark (str) {
	var num = 0;
	str.replace(/ /g, function () {
		num ++
	})
	return num
}

function parseCSS(s) {
	var least={children:{}};


	comments = {};
	var i = 1;

	//replace comments with marks;
	s=s.replace(/\/\*[\s\S]*?\*\//gm, function (a){
		comments[++i] = a;
		return makeMark(i);
	});

	//inside comments to fake declarations;
	s=s.replace(/([^{]+)\{([^}]+)\}/g, function(group, selector, declarations) {

		return selector + '{' +declarations.replace(/\t{10} +\t{10}/g, function (a){
			a = decodeMark(a);
			return 'comment__-'+a+': '+a+';'
		})+'}';
	});


	//outside comments to fake selectors;
	s=s.replace(/\t{10} +\t{10}/g, function (a){
		a = decodeMark(a);
		return '.__comment__-'+a+' { index: '+a+';}'
	});


	dataURLs = {};

	//dataURL to fake url
	s=s.replace(/url\((data:[^\)]+)\)/gm, function (a, dataURL){
		dataURLs[++i] = dataURL;
		return 'url(__data__'+ i +')';
	})


	s.replace(/([^{]+)\{([^}]+)\}/g, function(group, selector, declarations) {
		var o={};
		o.source=group;
		o.selector=tr(selector);

		var path=least;

		if (o.selector.indexOf(',')>-1) {
			// Comma: grouped selector, we skip
			var sel=o.selector;
			if (!path.children[sel]) {
				path.children[sel]={children:{}, declarations:[]};
			}
			path = path.children[sel];
		} else {
			// No comma: we process

			// Fix to prevent special chars to break into parts
			o.selector=o.selector.replace(/\s*([>\+~])\s*/g, ' &$1');
			o.selector=o.selector.replace(/(\w)([:\.])/g, '$1 &$2');

			o.selectorParts=o.selector.split(/[\s]+/);
			for (var i=0; i<o.selectorParts.length; i++) {
				var sel=o.selectorParts[i];
				// We glue the special chars fix
				sel=sel.replace(/&(.)/g, '& $1 ');
				sel=sel.replace(/& ([:\.]) /g, '&$1');

				if (!path.children[sel]) {
					path.children[sel]={children:{}, declarations:[]};
				}
				path = path.children[sel];
			}
		}


		declarations.replace(/([^:;]+):([^;]+)/g, function(decl, prop, val) {

			//remove hacks
			if(removeHacks){
				decl = decl
				.replace(/\s*[\*_].*/g, '')
				.replace(/.*(-webkit-|-o-|-moz-|-ms-|-khtml-|DXImageTransform|\\9|\\0|expression|opacity\s*=).*/g, '')
				if (!$.trim(decl)) {
					return
				}
			};

			val = trimColor(val);
			if (vars[val]){
				val = vars[val];
			} else {
				var a = [];
				$.each(val.split(' '), function(){
					a.push(vars[this] || this)
				});
				val = a.join(' ');
			}
			
			var declaration={
				source:decl,
				property:tr(prop),
				value:tr(val)
			};
			path.declarations.push(declaration);
		});
	});

	return exportObject(least);
}
var depth=0;
var s='';
function exportObject(path) {
	var s='';
	$.each(path.children, function(key, val) {
		if(key.slice(0,12) == '.__comment__'){
			keepOutsideComments && (s+=getIndent() + comments[val.declarations[0].value]+'\n');
			return
		} else {
			s+=getIndent()+key+' '+openingBracket+'\n';
		}
		depth++;
		for (var i=0; i<val.declarations.length; i++) {
			var decl=val.declarations[i];
			if (decl.property.slice(0,9) == 'comment__'){
				keepInsideComments && (s+=getIndent() + comments[decl.value]+'\n');
			} else {
				s+=getIndent()+decl.property+semiColumn+' '+decl.value+eol+'\n';
			}
			
		}
		s+=exportObject(val);
		depth--;
		s+=getIndent()+closingBracket+'\n';
	});

	// Remove blank lines - http://stackoverflow.com/a/4123442
	s=s.replace(/^\s*$[\n\r]{1,}/gm, '');


	s=s.replace(/url\(__data__(\d+)\)/gm, function (a, i){
		return 'url('+dataURLs[i]+')';
	})

	return s;
}
function getIndent() {
	var s='';
	for (var i=0; i<depth; i++) {
		s+=indentS;
	}
	return s;
}
