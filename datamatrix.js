/**
	https://github.com/datalog/datamatrix-svg
	under MIT license
	# datamatrix.js has no dependencies
	Copyright (c) 2020-2026 Constantine
*/

'use strict';

function DATAMatrix( Q ) {

	function textMode( table, extended ) { /* keep the table local to one mode. */

		var values = [];

		function valuesFor( ch ) {
			if( values[ ch ] ) return values[ ch ];
			if( 256 === ch ) return values[ ch ] = extended ? [ 1, 27 ] : []; /* FNC1 */

			var value = extended ? ch & 127 : ch ,j = 1 ,shift ,raw = [];
			while( value > table[ j ] ) j += 3;
			shift = table[ j + 1 ];
			if( 8 !== shift ) {
				if( extended && ch >= 128 ) raw.push( 1, 30 );
				if( shift < 5 ) raw.push( shift );
				raw.push( value - table[ j + 2 ] );
			}
			return values[ ch ] = raw;
		}

		return {
			 search: function( text, capacity, offer ) {

				var sum = 0 ,best = [];
				return function( end, prefix, ch ) {
					var count = valuesFor( ch ).length ,tail = text.length - end ,entry ,total ,cost ,implicit;
					if( !count ) { best.length = sum = 0; return; }
					bestStart( best, sum % 3, end - 1, prefix - 2 * ( sum / 3 | 0 ) );
					sum += count;
					for( total = sum; total <= sum + ( extended && !tail ); total++ ) {
						entry = best[ total % 3 ];
						if( !entry ) continue;
						cost = entry.cost + 1 + 2 * ( total / 3 | 0 );
						implicit = !tail && capacity - cost <= ( total === sum );
						offer( entry.start, end, cost + !implicit, implicit << 1 );
						if( 1 === tail && cost + 1 === capacity ) {
							ch = charCode( text, end );
							if( ch < 128 || 256 === ch ) offer( entry.start, text.length, cost + 1, 2 | 1 << 3 );
						}
					}
				};
			}
			,encode: function( chunk, result, flags ) {

				var count = 0 ,packed = 0 ,i ,j ,raw;
				result.push( table[ 0 ] );
				for( i = 0; i < chunk.length; i++ ) {
					raw = valuesFor( charCode( chunk, i ) );
					for( j = 0; j < raw.length; j++ ) {
						packed = 40 * packed + raw[ j ];
						if( 3 === ++count ) {
							result.push( ++packed >> 8, packed & 255 );
							count = packed = 0;
						}
					}
				}
				/* ISO/IEC 16022:2024, 7.2.5.3(b): pad with Shift 1 (0). The +1 is part of triplet packing. */
				if( count === 2 ) { packed = 40 * packed + 1; result.push( packed >> 8, packed & 255 ); }
				if( !( flags & 2 ) ) result.push( 254 );
			}
		};
	}

	var
	 M = []
	,xx = 0
	,yy = 0

	,isDigit = function( code ) {

		return code >= 48 && code <= 57;
	}

	,charCode = function( text, at ) {

		return text.charCodeAt( at );
	}

	,bestStart = function( state, slot, start, cost ) {

		var entry = state[ slot ] || ( state[ slot ] = { cost: Infinity } );
		if( cost < entry.cost ) { entry.start = start; entry.cost = cost; }
	}

	,bit = function( x, y ) {

		( M[ y ] = M[ y ] || [] )[ x ] = 1; /* M[ y ][ x ] = 1 */
	}

	/* Mode keys:
		MODES[ 0 ] must be ASCII. Other modes may be added, removed or reordered.
		search   : required; returns a private transition function (end, prefixCost, charCode).
		           offer(start, end, totalCost, flags) includes the header cost.
		encode   : required; (chunk, result, flags) appends codewords.
	*/
	,MODES = [
		 { /* ASCII: single bytes, upper shift and pairs of digits. */
			 search: function( text, capacity, offer ) {

				var pair = Infinity;
				return function( end, prefix, ch ) {
					offer( end - 1, end, prefix + ( ch < 128 || 256 === ch ? 1 : 2 ) );
					if( isDigit( ch ) ) {
						offer( end - 2, end, pair + 1 );
						pair = prefix;
					} else pair = Infinity;
				};
			}
			,encode: function( chunk, result ) {

				var start = 0 ,end = chunk.length ,ch ,next;
				while( start < end ) {
					ch = charCode( chunk, start++ );
					if( 256 === ch ) result.push( 232 );
					else if( isDigit( ch ) && isDigit( next = charCode( chunk, start ) ) ) {
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
			 search: function( text, capacity, offer ) {

				var best = [];
				return function( end, prefix, ch ) {
					var start = end - 1 ,tail = text.length - end ,entry ,cost ,count ,next ,i;
					if( ch < 32 || ch > 94 ) { best.length = 0; return; }
					bestStart( best, start % 4, start, prefix - 3 * ( start / 4 | 0 ) );
					for( i = 0; i < 4; i++ ) {
						entry = best[ i ];
						if( !entry ) continue;
						count = ( end - i ) & 3;
						cost = entry.cost + 1 + 3 * ( ( end - i ) >> 2 );
						if( cost + 3 <= capacity )
							offer( entry.start, end, cost + ( count < 3 ? count + 1 : 3 ) );
						else if( !count && tail <= 2 ) { /* implicit unlatch after a full group */
							ch = charCode( text, end );
							next = charCode( text, end + 1 );
							if( ch >= 128 && 256 !== ch || next >= 128 && 256 !== next ) continue;
							offer( entry.start, text.length, cost + ( 2 === tail && isDigit( ch ) && isDigit( next ) ? 1 : tail ),
								2 | tail << 3 );
						}
					}
				};
			}
			,encode: function( chunk, result, flags ) {

				var i = 0 ,bits = 0 ,packed = 0;
				result.push( 240 );
				if( !( flags & 2 ) ) chunk += '\x1f';
				while( i < chunk.length ) {
					packed = packed << 6 | charCode( chunk, i++ ) & 63;
					bits += 6;
					if( bits >= 8 ) result.push( packed >> ( bits -= 8 ) & 255 );
				}
				if( bits ) result.push( packed << ( 8 - bits ) & 255 );
			}
		 }

		,{ /* Base 256: length and bytes randomized at their final stream positions. */
			 search: function( text, capacity, offer ) {

				var best = Infinity ,start;
				return function( end, prefix, ch ) {
					var at = end - 1 ,cost = prefix - at ,count ,rest;
					if( ch > 255 ) { best = Infinity; return; }
					/* A newer equal minimum has no larger length header. */
					if( cost <= best ) { best = cost; start = at; }
					count = end - start;
					if( count > 1556 ) return; /* No other start can fit ECC 200 either. */
					rest = count > 249 && end === text.length && best + end + 2 === capacity;
					offer( start, end, best + end + 2 + ( count > 249 && !rest ), rest ? 4 : 0 );
				};
			}
			,encode: function( chunk, result, flags ) {

				var length = flags & 4 ? 0 : chunk.length ,i = 0;

				var push = function( value ) {
					result.push( ( value + 149 * ( result.length + 1 ) % 255 + 1 ) & 255 );
				};

				result.push( 231 );
				if( length > 249 ) push( ( length / 250 | 0 ) + 249 ), push( length % 250 );
				else push( length );
				while( i < chunk.length ) push( charCode( chunk, i++ ) );
			}
		 }
	]


	,prepareMessage = function( text, escaped ) {

		var header = [];

		if( escaped ) {

			text = text.replace( /\\x([0-9a-f]{2})|\\(\\)/gi, function( all, hex, slash ) {
				return hex ? String.fromCharCode( parseInt( hex, 16 ) ) : slash;
			});

			/* Macro 05/06: ISO/IEC 16022:2024, 7.2.4.8 / Table 3.
			   A complete wrapper takes priority over leading FNC1. */
			text = text.replace( /^(?:\[\)>\x1e0([56])\x1d([\s\S]*)\x1e\x04\s*$|<FNC1>)/i, function( all, macro, body ) {
				header.push( macro ? +macro + 231 : 232 );
				return body || '';
			});
		}

		text = unescape( encodeURI( text ) );

		if( escaped ) {
			/* Explicit FNC1 is always a command; GS becomes FNC1 only in GS1. */
			text = text.replace( /(<FNC1>)|<GS>|\x1d/gi, function( all, fnc1 ) {
				return fnc1 || 232 === header[ 0 ] ? '\u0100' : '\x1d';
			});
		}

		if( /[\x80-\xff]/.test( text ) )
			header.push( 241, 27 ); /* ECI 000026: UTF-8. */

		return { text: text, header: header };
	}

	,findSegments = function( text, capacity, header ) {

		var missing = [ Infinity ] ,history = [[ header.length ]] ,steps = [] ,modeCount = MODES.length ,end ,mode ,ch ,prefix;

		/* History: cost, start, mode, flags. Flags: implicit=2, rest=4, tail<<3. */
		var offer = function( start, end, cost, flags ) {
			if( cost === Infinity || cost > capacity || history[ end ] && cost >= history[ end ][ 0 ] ) return;
			if( 0 === mode && start && 0 === history[ start ][ 2 ] ) start = history[ start ][ 1 ];
			history[ end ] = [ cost, start, mode, flags || 0 ];
		};

		mode = modeCount;
		while( mode-- ) steps[ mode ] = MODES[ mode ].search( text, capacity, offer );

		for( end = 1; end <= text.length; end++ ) {
			ch = charCode( text, end - 1 );
			prefix = ( history[ end - 1 ] || missing )[ 0 ];
			mode = modeCount;
			while( mode-- ) steps[ mode ]( end, prefix, ch );
		}
		return { cost: ( history[ text.length ] || missing )[ 0 ], history: history };
	}

	,writeSegments = function( text, history, header ) {

		var segments = [] ,result = header.slice() ,end = text.length ,segment ,mode ,flags ,split;
		while( end ) {
			segments.push( end );
			end = history[ end ][ 1 ];
		}
		while( segments.length ) {
			end = segments.pop();
			segment = history[ end ];
			mode = MODES[ segment[ 2 ] ];
			flags = segment[ 3 ];
			split = end - ( flags >> 3 );
			mode.encode( text.slice( segment[ 1 ], split ), result, flags );
			if( split < end ) MODES[ 0 ].encode( text.slice( split, end ), result );
		}
		return result;
	}

	,encodeSegments = function( text, rectangular, header, version ) {

		var table = DATAMatrix.formats ,format ,i ,capacity ,base ,plan ,best ,rank ,bestRank ,rejected = [];
		if( text.length > 3116 ) throw new RangeError( 'Message exceeds Data Matrix capacity' );
		if( !version ) base = findSegments( text, Infinity, header );

		do {
			for( best = null, bestRank = Infinity, i = version ? table.length : rectangular > 1 ? 48 : rectangular ? 30 : 24; i--; ) {
				format = table[ i ];
				if( version ) {
					if( version === format[ 2 ] + 'x' + ( format[ 3 ] || format[ 2 ] ) ) { best = format; break; }
				} else if( format[ 1 ] >= base.cost - 2 && !rejected[ format[ 1 ] ] ) {
					rank = format[ 3 ] ? format[ 2 ] * ( 32 * format[ 3 ] + 1 ) : Infinity; /* area, then height */
					if( rank <= bestRank ) best = format, bestRank = rank;
				}
			}
			if( !best ) break;
			capacity = best[ 1 ];
			/* EDIFACT needs a capacity-specific ending with at most two words left. */
			plan = base && capacity > base.cost + 2 ? base : findSegments( text, capacity, header );
			if( plan.cost <= capacity ) return { words: writeSegments( text, plan.history, header ), format: best };
			rejected[ capacity ] = true;
		} while( base );
		throw new RangeError( version && !best ? 'Unsupported Data Matrix version' : 'Message exceeds Data Matrix capacity' );
	}

	,encodeMsg = function( text, rct, escaped, version ) {

		var
		 message = prepareMessage( text, escaped )
		,selected = encodeSegments( message.text, rct, message.header, version )
		,enc = selected.words
		,el = enc.length
		,format = selected.format
		,nc = format[ 0 ], nr = format[ 3 ] ? 1 : nc
		,w = ( format[ 3 ] || format[ 2 ] ) - 2 * nc, h = format[ 2 ] - 2 * nr
		,fw = w / nc, fh = h / nr
		,capacity = format[ 1 ], l = w * h >> 3, b = l > 255 ? 2 * ( l >> 9 ) + 2 : 1
		,s = ( l - capacity ) / b
		,i, j, c, r, k
		,rs = [], rc = []
		,lg = new Array( 256 ), ex = new Array( 255 );

		/* first padding */
		if( el < capacity ) enc[ el++ ] = 129;

		/* More padding: ISO/IEC 16022:2024, B.2.2; retain 254. */
		while( el < capacity ) {

			enc[ el++ ] = ( ( ( 149 * el ) % 253 ) + 130 ) % 254 || 254;
		}


		/* Reed Solomon error detection and correction */
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
		rc[ s ] = 0;
		c = b;
		while( c-- ) {
			i = s;
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
				if( 0 == ( j & 1 ) ) bit( j, i );
			}
		}

		/* vertical */
		for( i = 0; i < w + 2 * nc; i += fw + 2 ) {
			j = h;
			while( j-- ) {
				bit( i, j + ( j / fh | 0 ) * 2 + 1 );
				if( 1 == ( j & 1 ) ) bit( i + fw + 1, j + ( j / fh | 0 ) * 2 );
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

			if( r == h - 3 && - 1 == c )

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

			else if( r == h + 1 && 1 == c && 0 == ( w & 7 ) && 6 == ( h & 7 ) )

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
				if( 0 == r && c == w - 2 && ( w & 3 ) ) continue; /* corner B: omit upper left */
				if( r < 0 || c >= w || r >= h || c < 0 ) { /* outside */

					 s  = -s /* turn around */
					,r += 2 + s / 2
					,c += 2 - s / 2;

					while( r < 0 || c >= w || r >= h || c < 0 ) {

						 r -= s
						,c += s;
					}
				}
				if( r == h - 2 && 0 == c && ( w & 3 ) )

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

				else if( r == h - 2 && 0 == c && 4 == ( w & 7 ) )

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

				else if( 1 == r && c == w - 1 && 0 == ( w & 7 ) && 6 == ( h & 7 ) ) continue; /* omit corner D */
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
					if( y >= h ) y -= h; /* DMRE placement wrap. */

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

		encodeMsg( q.msg || '', q.rct, q.esc, q.ver );

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

/* Format: region columns, data words, height, optional width.
   24 squares, 6 original rectangles, 18 DMRE (ISO/IEC 21471:2025, Table 1).
   Region rows equal columns for squares, otherwise 1. */
DATAMatrix.formats = [
	 [    1,    3,   10 ]
	,[    1,    5,   12 ]
	,[    1,    8,   14 ]
	,[    1,   12,   16 ]
	,[    1,   18,   18 ]
	,[    1,   22,   20 ]
	,[    1,   30,   22 ]
	,[    1,   36,   24 ]
	,[    1,   44,   26 ]
	,[    2,   62,   32 ]
	,[    2,   86,   36 ]
	,[    2,  114,   40 ]
	,[    2,  144,   44 ]
	,[    2,  174,   48 ]
	,[    2,  204,   52 ]
	,[    4,  280,   64 ]
	,[    4,  368,   72 ]
	,[    4,  456,   80 ]
	,[    4,  576,   88 ]
	,[    4,  696,   96 ]
	,[    4,  816,  104 ]
	,[    6, 1050,  120 ]
	,[    6, 1304,  132 ]
	,[    6, 1558,  144 ]
	/* ISO/IEC 16022 rectangles. */
	,[    1,    5,    8,   18 ]
	,[    2,   10,    8,   32 ]
	,[    1,   16,   12,   26 ]
	,[    2,   22,   12,   36 ]
	,[    2,   32,   16,   36 ]
	,[    2,   49,   16,   48 ]
	/* ISO/IEC 21471 DMRE. */
	,[    2,   18,    8,   48 ]
	,[    4,   24,    8,   64 ]
	,[    4,   32,    8,   80 ]
	,[    4,   38,    8,   96 ]
	,[    6,   49,    8,  120 ]
	,[    6,   63,    8,  144 ]
	,[    4,   43,   12,   64 ]
	,[    4,   64,   12,   88 ]
	,[    4,   62,   16,   64 ]
	,[    2,   44,   20,   36 ]
	,[    2,   56,   20,   44 ]
	,[    4,   84,   20,   64 ]
	,[    2,   72,   22,   48 ]
	,[    2,   80,   24,   48 ]
	,[    4,  108,   24,   64 ]
	,[    2,   70,   26,   40 ]
	,[    2,   90,   26,   48 ]
	,[    4,  118,   26,   64 ]
];

if('undefined' !== typeof module && module.exports )
	module.exports = DATAMatrix;
