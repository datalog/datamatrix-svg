/**
	https://github.com/datalog/datamatrix-svg
	under MIT license
	# datamatrix.js has no dependencies
	Copyright (c) 2020-2026 Constantine
*/

'use strict';

function DATAMatrix( Q ) {

	function textMode( table, extended ) { /* keep the table local to one mode. */

		return {
			prepare: function() { /* shared table-driven byte mapping. */

				var values = [] ,ch = 256 ,value ,j ,shift ,prefix;
				while( ch-- ) {
					value = ch;
					prefix = [];
					if( value >= 128 && extended ) { prefix = [ 1, 30 ]; value -= 128; }
					for( j = 1; value > table[ j ]; j += 3 );
					shift = table[ j + 1 ];
					if( 8 === shift ) continue;
					if( shift < 5 ) prefix.push( shift );
					prefix.push( value - table[ j + 2 ] );
					values[ ch ] = prefix;
				}
				if( extended ) values[ 256 ] = [ 1, 27 ]; /* FNC1: ISO/IEC 16022:2024, Tables C.1/C.2. */
				return values;
			}
			,scan: function( text, start, capacity, prefix, offer, values, ascii ) {

				/* count: mode values; cost/prefix: codewords. */
				var count = 0 ,end ,raw ,cost ,ch;
				for( end = start + 1; end <= text.length; end++ ) {
					raw = values[ charCode( text, end - 1 ) ];
					if( !raw ) break;
					count += raw.length;
					cost = 1 + ( count / 3 | 0 ) * 2;
					if( prefix + cost > capacity ) break;
					if( 0 === count % 3 ) {
						offer( end, cost + 1 );
						if( end === text.length && capacity < Infinity && capacity - prefix - cost <= 1 ) offer( end, cost, { implicit: true } );
						if( ascii && end === text.length - 1 && prefix + cost + 1 === capacity ) {
							ch = charCode( text, end );
							if( ch < 128 || 256 === ch ) offer( text.length, cost + 1, { implicit: true, tail: 1 } );
						}
					}
					if( extended && 2 === count % 3 && end === text.length ) {
						cost += 2;
						offer( end, cost + 1, { pad: true } );
						if( prefix + cost === capacity ) offer( end, cost, { pad: true, implicit: true } );
					}
				}
			}
			,encode: function( text, segment, result, values, ascii ) {
				toText( text, segment, result, values, ascii, table[ 0 ] );
			}
		};
	}

	var
	 M = []
	,xx = 0
	,yy = 0

	,ceil = Math.ceil

	,isDigit = function( code ) {

		return code >= 48 && code <= 57;
	}

	,charCode = function( text, at ) {

		return text.charCodeAt( at );
	}

	,bit = function( x, y ) {

		( M[ y ] = M[ y ] || [] )[ x ] = 1; /* M[ y ][ x ] = 1 */
	}

	/* Mode keys:
		fallback : optional; marks the ASCII encoder used for implicit trailing bytes.
		prepare  : optional; builds per-mode data once before the segment search.
		scan     : required; offers segment ends and word costs through offer().
		encode   : required; appends a selected segment's codewords to the result.
	*/
	,MODES = [
		 { /* ASCII: single bytes, upper shift and pairs of digits. */
			 fallback: true
			,scan: function( text, start, capacity, prefix, offer ) {

				var ch = charCode( text, start );
				offer( start + 1, ch < 128 || 256 === ch ? 1 : 2 );
				if( isDigit( ch ) && isDigit( charCode( text, start + 1 ) ) ) offer( start + 2, 1 );
			}
			,encode: function( text, segment, result ) {

				var start = segment.start ,end = segment.end ,ch ,next;
				while( start < end ) {
					ch = charCode( text, start++ );
					if( 256 === ch ) result.push( 232 );
					else if( isDigit( ch ) && start < end && isDigit( next = charCode( text, start ) ) ) {
						result.push( 130 + ( ch - 48 ) * 10 + next - 48 );
						start++;
					} else if( ch >= 128 ) result.push( 235, ch - 127 );
					else result.push( ch + 1 );
				}
			}
		 }

		,textMode( [ /* C40 */
			 230
			, 31,   0,   0
			, 32,   9,  29
			, 47,   1,  33
			, 57,   9,  44
			, 64,   1,  43
			, 90,   9,  51
			, 95,   1,  69
			,127,   2,  96
		], true )

		,textMode( [ /* Text */
			 239
			, 31,   0,   0
			, 32,   9,  29
			, 47,   1,  33
			, 57,   9,  44
			, 64,   1,  43
			, 90,   2,  64
			, 95,   1,  69
			, 96,   2,  96
			,122,   9,  83
			,127,   2,  96
		], true )

		,textMode( [ /* ANSI X12 */
			 238
			, 12,   8,   0
			, 13,   9,  13
			, 31,   8,   0
			, 32,   9,  29
			, 41,   8,   0
			, 42,   9,  41
			, 47,   8,   0
			, 57,   9,  44
			, 61,   8,   0
			, 62,   9,  60
			, 64,   8,   0
			, 90,   9,  51
			,255,   8,   0
		], false )

		,{ /* EDIFACT: groups of four six-bit values. */
			 scan: function( text, start, capacity, prefix, offer, data, ascii ) {

				var end ,count ,cost ,tail ,ch ,next;
				for( end = start + 1; end <= text.length; end++ ) {
					ch = charCode( text, end - 1 );
					if( ch < 32 || ch > 94 ) break;
					count = end - start;
					cost = 1 + ceil( ( count + 1 ) * 6 / 8 );
					if( prefix + cost - 2 > capacity ) break;
					tail = ceil( ( count % 4 + 1 ) * 6 / 8 );
					offer( end, cost, null, prefix + cost + 3 - tail );
					if( count % 4 || capacity === Infinity ) continue;
					cost = 1 + count / 4 * 3;
					if( capacity - prefix - cost > 2 ) continue;
					if( end === text.length ) offer( end, cost, { implicit: true } );
					if( !ascii || text.length - end > 2 ) continue;
					tail = text.length - end;
					ch = charCode( text, end );
					next = charCode( text, end + 1 );
					if( 2 === tail && isDigit( ch ) && isDigit( next ) ) tail = 1;
					else if( ch >= 128 && ch !== 256 || next >= 128 && next !== 256 ) continue;
					if( tail ) offer( text.length, cost + tail, { implicit: true, tail: text.length - end } );
				}
			}
			,encode: function( text, segment, result, data, ascii ) {

				var end = segment.end - ( segment.tail || 0 )
				,buffer = 0 ,bits = 0 ,i ,value;

				result.push( 240 );
				for( i = segment.start; i < end + ( segment.implicit ? 0 : 1 ); i++ ) {
					value = i === end ? 31 : charCode( text, i ) & 63;
					buffer = buffer << 6 | value;
					bits += 6;
					if( bits >= 8 ) {
						bits -= 8;
						result.push( buffer >>> bits & 255 );
					}
					buffer &= ( 1 << bits ) - 1;
				}
				if( bits ) result.push( buffer << ( 8 - bits ) );
				if( segment.tail ) ascii.encode( text, { start: end, end: segment.end }, result );
			}
		 }

		,{ /* Base 256: length and bytes randomized at their final stream positions. */
			 scan: function( text, start, capacity, prefix, offer ) {

				var end ,count ,cost;
				for( end = start + 1; end <= text.length; end++ ) {
					count = end - start;
					if( count > 1556 || charCode( text, end - 1 ) > 255 ) break;
					cost = count + ( count <= 249 ? 2 : 3 );
					if( prefix + cost - 1 > capacity ) break;
					offer( end, cost );
					if( count > 249 && end === text.length && prefix + count + 2 === capacity ) offer( end, count + 2, { rest: true } );
				}
			}
			,encode: function( text, segment, result ) {

				var length = segment.end - segment.start ,i;
				var push = function( value ) {
					result.push( ( value + ( 149 * ( result.length + 1 ) % 255 ) + 1 ) & 255 );
				};

				result.push( 231 );
				if( segment.rest ) push( 0 );
				else if( length <= 249 ) push( length );
				else { push( ( length / 250 | 0 ) + 249 ); push( length % 250 ); }
				for( i = segment.start; i < segment.end; i++ ) push( charCode( text, i ) );
			}
		 }
	]

	,toText = function( text, segment, result, values, ascii, latch ) { /* shared triplet packing for C40, Text and X12. */

		var end = segment.end - ( segment.tail || 0 )
		,count = 0 ,packed = 0 ,i ,j ,raw;

		var push = function( value ) {
			packed = 40 * packed + value;
			if( ++count === 3 ) {
				result.push( ++packed >> 8, packed & 255 );
				count = packed = 0;
			}
		};

		result.push( latch );
		for( i = segment.start; i < end; i++ ) {
			raw = values[ charCode( text, i ) ];
			for( j = 0; j < raw.length; j++ ) push( raw[ j ] );
		}
		if( segment.pad ) push( 0 );
		if( !segment.implicit ) result.push( 254 );
		if( segment.tail ) ascii.encode( text, { start: end, end: segment.end }, result );
	}

	,prepareMessage = function( text, escaped ) {

		var header = [];

		if( escaped ) {

			text = text.replace( /\\x([0-9a-f]{2})|\\(\\)/gi, function( all, hex, slash ) {
				return hex ? String.fromCharCode( parseInt( hex, 16 ) ) : slash;
			});

			/* Macro 05/06: ISO/IEC 16022:2024, 7.2.4.8 / Table 3; allow trailing whitespace. */
			text = text.replace( /^\[\)>\x1e0([56])\x1d([\s\S]*)\x1e\x04\s*$/, function( all, macro, body ) {
				header.push( +macro + 231 );
				return body;
			});

			/* Leading FNC1 selects GS1 when no Macro header is present. */
			if( !header.length && /^<FNC1>/i.test( text ) ) {
				header.push( 232 );
				text = text.slice( 6 );
			}
		}

		text = unescape( encodeURI( text ) );

		if( escaped ) {
			/* Explicit FNC1 is always a command; GS becomes FNC1 only in GS1. */
			text = text.replace( /(<FNC1>)|<GS>|\x1d/gi, function( all, fnc1 ) {
				return fnc1 || header[ 0 ] === 232 ? '\u0100' : '\x1d';
			});
		}

		if( /[\x80-\xff]/.test( text ) )
			header.push( 241, 27 ); /* ECI 000026: UTF-8. */

		return { text: text, header: header };
	}

	,findSegments = function( text, capacity, data, ascii, header ) { /* mode-independent shortest path. */

		var costs = [ header.length ] ,history = [] ,start ,end ,mode;
		end = text.length;
		while( end ) costs[ end-- ] = Infinity;

		var offer = function( end, size, options, required ) {
			var cost = costs[ start ] + size;
			if( cost > capacity || required > capacity || cost >= costs[ end ] ) return;
			var segment = options || {};
			segment.start = start;
			segment.end = end;
			segment.mode = mode;
			costs[ end ] = cost;
			history[ end ] = segment;
		};

		for( start = 0; start < text.length; start++ ) {
			if( costs[ start ] >= capacity ) continue;
			for( mode = 0; mode < MODES.length; mode++ ) {
				MODES[ mode ].scan( text, start, capacity, costs[ start ], offer, data[ mode ], ascii );
			}
		}
		return { cost: costs[ text.length ], history: history };
	}

	,writeSegments = function( text, history, data, ascii, header ) {

		var segments = [] ,result = header.slice() ,end = text.length ,segment;
		while( end ) {
			segment = history[ end ];
			segments.push( segment );
			end = segment.start;
		}
		while( segments.length ) {
			segment = segments.pop();
			MODES[ segment.mode ].encode( text, segment, result, data[ segment.mode ], ascii );
		}
		return result;
	}

	,encodeSegments = function( text, rectangular, header ) {

		header = header || [];

		var
		 data = [] ,ascii
		,square = [ 3, 5, 8, 12, 18, 22, 30, 36, 44, 62, 86, 114, 144, 174, 204, 280, 368, 456, 576, 696, 816, 1050, 1304, 1558 ]
		,rectangle = [ 5, 10, 16, 22, 32, 49 ]
		,i ,mode ,capacities ,plan ,minimum;

		if( text.length > 3116 ) throw new RangeError( 'Message exceeds Data Matrix capacity' );
		mode = MODES.length;
		while( mode-- ) {
			if( MODES[ mode ].prepare ) data[ mode ] = MODES[ mode ].prepare();
			if( MODES[ mode ].fallback ) ascii = MODES[ mode ];
		}

		plan = findSegments( text, Infinity, data, ascii, header );
		minimum = plan.cost - 2; /* end-of-symbol rules can save up to two words. */
		capacities = rectangular ? rectangle.concat( square.slice( 9 ) ) /* square capacities above 49 */ : square;
		for( i = 0; i < capacities.length; i++ ) {
			if( capacities[ i ] < minimum ) continue;
			plan = findSegments( text, capacities[ i ], data, ascii, header );
			if( plan.cost <= capacities[ i ] ) return { words: writeSegments( text, plan.history, data, ascii, header ), capacity: capacities[ i ] };
		}
		throw new RangeError( 'Message exceeds Data Matrix capacity' );
	}

	,encodeMsg = function( text, rct, escaped ) {

		var
		 message = prepareMessage( text, escaped )
		,selected = encodeSegments( message.text, rct, message.header )
		,enc = selected.words
		,el = enc.length
		,k, l;

		var
		 h, w, nc = 1, nr = 1, fw, fh /* symbol size, regions, region size */
		,i, j = - 1, c, r, s, b = 1 /* compute symbol size */

		,rs = new Array(  70 ) /* reed / solomon code */
		,rc = new Array(  70 )
		,lg = new Array( 256 ) /* log / exp table for multiplication */
		,ex = new Array( 255 );

		if( rct && selected.capacity < 50 ) {

			/* rect */

			k = [	/* symbol width, checkwords */
				 16,  7
				,28, 11
				,24, 14
				,32, 18
				,32, 24
				,44, 28
			];

			do {
				w = k[ ++j ]; /* width */
				h = 6 + ( j & 12 ); /* height */
				l = w * h / 8; /* bytes count in symbol */

			} while( l - k[ ++j ] < selected.capacity ); /* could we fill the rect? */

			/* column regions */
			if( w > 25 ) nc = 2;

		} else {

			/* square */

			w = h = 6;
			i = 2; /* size increment */
			k = [ 5, 7, 10, 12, 14, 18, 20, 24, 28, 36, 42, 48, 56, 68, 84, 112, 144, 192, 224, 272, 336, 408, 496, 620 ]; /* rs checkwords */

			do {
				++j; /* capacity was already selected by encodeSegments. */

				if( w > 11 * i ) i = 4 + i & 12; /* advance increment */

				w = h += i;
				l = ( w * h ) >> 3;

			} while( l - k[ j ] < selected.capacity );

			if( w > 27 ) nr = nc = 2 * ( w / 54 | 0 ) + 2; /* regions */
			if( l > 255 ) b = 2 * ( l >> 9 ) + 2; /* blocks */
		}


		 s = k[ j ] /* rs checkwords */
		,fw = w / nc /* region size */
		,fh = h / nr;

		/* first padding */
		if( el < l - s ) enc[ el++ ] = 129;

		/* more padding */
		while( el < l - s ) {

			enc[ el++ ] = ( ( ( 149 * el ) % 253 ) + 130 ) % 254;
		}


		/* Reed Solomon error detection and correction */
		s /= b;

		/* log / exp table of Galois field */
		for( j = 1, i = 0; i < 255; i++ ) {

			ex[ i ] = j
			,lg[ j ] = i
			,j += j;

			if( j > 255 ) j ^= 301; /* 301 == a^8 + a^5 + a^3 + a^2 + 1 */
		}

		/* RS generator polynomial */
		for( rs[ s ] = 0, i = 1; i <= s; i++ )
			for( j = s - i, rs[ j ] = 1; j < s; j++ )
				rs[ j ] = rs[ j + 1 ] ^ ex[ ( lg[ rs[ j ] ] + i ) % 255 ];

		/* RS correction data for each block */
		c = b;
		while( c-- ) {
			i = s + 1;
			while( i-- ) rc[ i ] = 0;
			for( i = c; i < el; i += b )
				for( j = 0, x = rc[ 0 ] ^ enc[ i ]; j < s; j++ )
					rc[ j ] = rc[ j + 1 ] ^ ( x ? ex[ ( lg[ rs[ j ] ] + lg[ x ] ) % 255 ] : 0 );

			/* ISO/IEC 16022:2024, Annex A.1 / Figure A.2: ECC starts with block 1.
			   For 144x144, zero-based block order is 0..9; keep this ISO order.
			   Historical de facto order is 8,9,0..7, as expected by ZXing Java 3.5.3.
			   A failure in that decoder alone does not prove invalid ECC; see README.
			   Historical compatibility alternative (inactive; do not run both loops):
			   while( i-- ) enc[ el + ( 10 === b ? ( c + 2 ) % b : c ) + i * b ] = rc[ i ];
			*/
			i = s;
			while( i-- ) enc[ el + c + i * b ] = rc[ i ]; /* ISO/IEC 16022:2024 */
		}

		/* layout perimeter finder pattern */
		/* horizontal */
		for( i = 0; i < h + 2 * nr; i += fh + 2 ) {
			j = w + 2 * nc;
			while( j-- ) {
				bit( j, i + fh + 1 );
				if( ( j & 1 ) == 0 ) bit( j, i );
			}
		}

		/* vertical */
		for( i = 0; i < w + 2 * nc; i += fw + 2 ) {
			j = h;
			while( j-- ) {
				bit( i, j + ( j / fh | 0 ) * 2 + 1 );
				if( ( j & 1 ) == 1 ) bit( i + fw + 1, j + ( j / fh | 0 ) * 2 );
			}
		}

		s = 2 /* step */
		,c = 0 /* column */
		,r = 4 /* row */
		,b = [ /* nominal byte layout */
			   0,  0
			, -1,  0
			, -2,  0
			,  0, -1
			, -1, -1
			, -2, -1
			, -1, -2
			, -2, -2
		];

		/* diagonal steps */
		for( i = 0; i < l; r -= s, c += s ) {

			if( r == h - 3 && c == - 1 )

				k = [ /* corner A layout */
					     w, 6 - h
					,    w, 5 - h
					,    w, 4 - h
					,    w, 3 - h
					,w - 1, 3 - h
					,    3,     2
					,    2,     2
					,    1,     2
				];

			else if( r == h + 1 && c == 1 && ( w & 7 ) == 0 && ( h & 7 ) == 6 )

				k = [ /* corner D layout */
					 w - 2,     -h
					,w - 3,     -h
					,w - 4,     -h
					,w - 2, -1 - h
					,w - 3, -1 - h
					,w - 4, -1 - h
					,w - 2,     -2
					,   -1,     -2
				];
			else {
				if( r == 0 && c == w - 2 && ( w & 3 ) ) continue; /* corner B: omit upper left */
				if( r < 0 || c >= w || r >= h || c < 0 ) { /* outside */

					 s  = -s /* turn around */
					,r += 2 + s / 2
					,c += 2 - s / 2;

					while( r < 0 || c >= w || r >= h || c < 0 ) {

						 r -= s
						,c += s;
					}
				}
				if( r == h - 2 && c == 0 && ( w & 3 ) )

					k = [ /* corner B layout */
						 w - 1, 3 - h
						,w - 1, 2 - h
						,w - 2, 2 - h
						,w - 3, 2 - h
						,w - 4, 2 - h
						,    0,     1
						,    0,     0
						,    0,    -1
					];

				else if( r == h - 2 && c == 0 && ( w & 7 ) == 4 )

					k = [ /* corner C layout */
						 w - 1, 5 - h
						,w - 1, 4 - h
						,w - 1, 3 - h
						,w - 1, 2 - h
						,w - 2, 2 - h
						,    0,     1
						,    0,     0
						,    0,    -1
					];

				else if( r == 1 && c == w - 1 && ( w & 7 ) == 0 && ( h & 7 ) == 6 ) continue; /* omit corner D */
				else k = b; /* nominal L - shape layout */
			}

			/* layout each bit */
			for( el = enc[ i++ ], j = 0; el > 0; j += 2, el >>= 1 ) {

				if( el & 1 ) {

					var
					 x = c + k[ j ]
					,y = r + k[ j + 1 ];

					/* wrap around */
					if( x < 0 ) x += w, y += 4 - ( ( w + 4 ) & 7 );
					if( y < 0 ) y += h, x += 4 - ( ( h + 4 ) & 7 );

					/* region gap */
					bit( x + 2 * ( x / fw | 0 ) + 1, y + 2 * ( y / fh | 0 ) + 1 );
				}
			}
		}


		/* unfilled corner */
		for( i = w; i & 3; i-- ) {

			bit( i, i );
		}

		 xx = w + 2 * nc
		,yy = h + 2 * nr;
	}

	return ( function() {

		function contourPath( modules, width, height ) { /* my november's moons and noons */

			var
			 stride = width + 1
			,edges = []
			,emptyRow = []
			,step = [
				   0        /* 0: no edge */
				,  1        /* 1: right */
				,  stride   /* 2: down */
				,  0        /* 3: unused */
				, -1        /* 4: left */
				,  0        /* 5: unused */
				,  0        /* 6: unused */
				,  0        /* 7: unused */
				, -stride   /* 8: up */
			]
			,path = ''
			,y = height
			,x
			,v;

			while( y-- ) { /* collect boundary edges with dark modules on the right. */

				var
				 row = modules[ y ]
				,above = modules[ y - 1 ] || emptyRow
				,below = modules[ y + 1 ] || emptyRow
				,rowStart = y * stride;

				x = width;

				while( x-- ) {

					if( !row[ x ] ) continue;

					v = rowStart + x;

					if( !above[ x ] ) edges[ v ] |= 1;
					if( !row[ x + 1 ] ) edges[ v + 1 ] |= 2;
					if( !below[ x ] ) edges[ v + stride + 1 ] |= 4;
					if( !row[ x - 1 ] ) edges[ v + stride ] |= 8;
				}
			}

			var
			 start = edges.length
			,prevX = 0
			,prevY = 0;

			while( start-- ) {
				if( !edges[ start ] ) continue;

				var
				 startX = start % stride
				,startY = ( start / stride ) | 0
				,dx = startX - prevX
				,dy = startY - prevY;

				path += 'm' + dx + ( dy < 0 ? '' : ',' ) + dy;
				prevX = startX;
				prevY = startY;

				var
				 stack = [ start ]
				,route = []
				,previous = start
				,previousStep = 0;

				while( stack.length ) { /* join branches into one closed route. */

					var
					 at = stack[ stack.length - 1 ]
					,mask = edges[ at ];

					if( !mask ) {

						var
						 vertex = stack.pop()
						,delta = vertex - previous;

						if( delta !== previousStep )
							route.push( previous );

						previousStep = delta;
						previous = vertex;
						continue;
					}

					var edge = mask & -mask;

					edges[ at ] = mask ^ edge;
					stack.push( at + step[ edge ] );
				}


				var
				 i = route.length
				,turn = start;

				while( --i ) { /* write turns from the reversed route. */

					var
					 vertex = route[ i ]
					,offset = vertex - turn;

					path += -stride < offset && offset < stride
						? 'h' + offset
						: 'v' + ( offset / stride );
					turn = vertex;
				}

				path += 'z';
			}

			return path;
		}

		function ishex( c ) {

			return /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test( c );
		}

		function svg( tag, attrs, children ) {

			var el, o, i = 0, len = children ? children.length : 0;

			if( str ) {
				el = '<' + tag;
				for( o in attrs ) el += ' ' + o + '="' + attrs[ o ] + '"';
				return len ? el + '>' + children.join( '' ) + '</' + tag + '>' : el + '/>';
			}

			el = document.createElementNS( ns, tag );
			for( o in attrs ) el.setAttribute( o, attrs[ o ] );
			while( i < len ) el.appendChild( children[ i++ ] );
			return el;
		}

		var
		 abs = Math.abs,
		layers = [], x, y, sx, sy,

		  ns = 'http://www.w3.org/2000/svg',
		path = '',

		   q = ('string' == typeof Q ) ? { msg: Q } : Q || {},
		 str = q.str,
		   p = q.pal || ['#000'],
		  dm = abs( q.dim ) || 256,
		  pd = abs( q.pad ), pd = ( pd > -1 ) ? pd : 2,
		  mx = [ 1, 0, 0, 1, pd, pd ],

		  fg = p[ 0 ], fg = ishex( fg ) ? fg : '#000',
		  bg = p[ 1 ], bg = ishex( bg ) ? bg :  0,

		/* render optimized or verbose svg */
		optimized = ( q.vrb ) ? 0 : 1;

		encodeMsg( q.msg || '', q.rct, q.esc );

		sx = xx + pd * 2,
		sy = yy + pd * 2;

		if( optimized ) {
			path = contourPath( M, xx, yy );
		} else {
			y = yy;

			while( y-- ) {
				x = xx;

				while( x-- ) {
					if( M[ y ][ x ] )
						path += 'M' + x + ',' + y + 'h1v1h-1z';
				}
			}
		}


		if( bg )
		layers.push( svg('path', {

					 'fill'			:  bg
					,'d'			: 'M0,0v' + sy + 'h' + sx + 'V0Z'
				} ) );

		layers.push( svg('path', {

					 'transform'		: 'matrix(' + mx + ')'
					,'d'			:  path
				} ) );

		return svg('svg', {

					 'viewBox'		: [ 0, 0, sx, sy ].join(' ')
					,'width'		:  dm / sy * sx | 0
					,'height'		:  dm
					,'fill'			:  fg
					,'shape-rendering'	: 'crispEdges'
					,'xmlns'		:  ns 
					,'version'		: '1.1'
				}, layers );

	} )();
}

if('undefined' !== typeof module && module.exports )
	module.exports = DATAMatrix;
