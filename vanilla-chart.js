
let globalHistoryData = {};
let chartInstance = null;
let recentDates = [];

async function initHistoryApp() {
    // --- 模拟数据开始 ---
    const mockData = {};
    const today = new Date();
    
    for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().split('T')[0]; // 格式化为 YYYY-MM-DD
        
        mockData[dateStr] = {
            "update_time": "10:15:00",
            "USD_THB": (32.20 + Math.random() * 0.5).toFixed(2),
            "USD_CNY": (6.80 + Math.random() * 0.1).toFixed(2),
            "USD_PHP": (60.10 + Math.random() * 0.8).toFixed(2)
        };
    }
    
    globalHistoryData = mockData;
    // --- 模拟数据结束 ---

    // 依然使用你原来的后续处理逻辑
    recentDates = Object.keys(globalHistoryData).sort().reverse().slice(0, 30);
    document.getElementById('loading-status').innerText = '✅ 模拟模式';
    updateView();
}

function switchMode(mode) {
    const app = document.getElementById('history-app');
    app.className = 'mode-' + mode;
    
    // 关键：切换显隐
    document.getElementById('list-view').style.display = (mode === 'list') ? 'block' : 'none';
    document.getElementById('chart-wrapper').style.display = (mode === 'chart') ? 'block' : 'none';

    if (mode === 'chart') {
        // 给浏览器 50ms 渲染容器，再画图
        setTimeout(renderChart, 50);
    }
}

function updateTimeRange(days) {
    // 1. 拿到所有存在数据的日期（从小到大排序）
    const allDates = Object.keys(globalHistoryData).sort(); 
    const dateInput = document.getElementById('start-date-input').value;

    if (dateInput) {
        // --- 场景：用户选了日期 ---
        // 找到这个日期在数组里的位置
        let idx = allDates.indexOf(dateInput);
        // 如果那天没数据，找它之后最接近的一天
        if (idx === -1) idx = allDates.findIndex(d => d > dateInput);
        
        if (idx !== -1) {
            // 从这天开始往后取，有几天拿几天，最多拿 days 天
            // slice 保证了只拿数组里有的，不会产生 29、30 号这种未来的虚假日期
            recentDates = allDates.slice(idx, idx + days).reverse();
        } else {
            // 选得太晚了，后面没数据，就保底显示最近 N 天
            recentDates = allDates.slice(-days).reverse();
        }
    } else {
        // --- 场景：默认状态（没选日期） ---
        // 直接拿数据库里最后（最新）的 N 条
        recentDates = allDates.slice(-days).reverse();
    }

    // 渲染
    updateView();
    if (document.getElementById('history-app').classList.contains('mode-chart')) {
        renderChart();
    }
}

function handleDateSelect(val) {
    updateTimeRange(parseInt(document.querySelector('input[name="time_range"]:checked').value));
}

function renderCustomRange(startDateStr, days) {
    if(!startDateStr || !globalHistoryData) return;
    
    const curr = document.querySelector('input[name="curr_type"]:checked').value;
    const startDate = new Date(startDateStr);
    let newDisplayDates = [];

    // 清除旧数据影子，确保不污染
    // 严格循环 N 天，不多不少
    for (let i = 0; i < days; i++) {
        let d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        
        let dateKey = d.getFullYear() + '-' + 
                      String(d.getMonth() + 1).padStart(2, '0') + '-' + 
                      String(d.getDate()).padStart(2, '0');
        
        newDisplayDates.push(dateKey);

        // 如果这一天没数据，手动补 0 用于排查
        if (!globalHistoryData[dateKey]) {
            globalHistoryData[dateKey] = {
                "update_time": "N/A",
                "USD_THB": "0.00", "USD_CNY": "0.00", "USD_PHP": "0.00"
            };
        }
    }

    // 列表要最新在前，所以反转
    recentDates = [...newDisplayDates].reverse();

    updateView();
    if (document.getElementById('history-app').classList.contains('mode-chart')) {
        renderChart();
    }
}

function updateView() {
    const curr = document.querySelector('input[name="curr_type"]:checked').value;
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';

    // 在 updateView 函数里修改表格输出
    recentDates.forEach(date => {
        const row = globalHistoryData[date];
        tbody.innerHTML += `<tr>
            <td>${date}</td>
            <td style="font-weight:bold; color:#ff6b00; font-size:1.1rem;">${row[curr]}</td>
            <!-- 缩小字体，改用灰色，让它作为辅助信息存在 -->
            <td style="color:#bbb; font-size:10px; font-family:monospace;">${row.update_time}</td>
        </tr>`;
    });

    if (document.getElementById('history-app').classList.contains('mode-chart')) {
        renderChart();
    }
}

function renderChart() {
    const curr = document.querySelector('input[name="curr_type"]:checked').value;
    const container = document.getElementById('chart-wrapper');
    if (!container || recentDates.length < 2) return;

    const data = [...recentDates].reverse().map(d => parseFloat(globalHistoryData[d][curr]));
    const realMin = Math.min(...data);
    const realMax = Math.max(...data);
    const diff = realMax - realMin || 0.01;

    // 顶部留出 25% 空间放两层数字
    const displayMin = realMin - (diff * 0.1); 
    const displayMax = realMax + (diff * 0.25); 
    const displayRange = displayMax - displayMin;

    const width = 800, height = 380;
    const paddingX = 40, paddingY = 60, bottomSpace = 70; 
    
    const pointsArr = data.map((val, i) => {
        const x = paddingX + (i * (width - paddingX * 2) / (data.length - 1));
        const y = height - bottomSpace - ((val - displayMin) / displayRange * (height - paddingY - bottomSpace));
        return {x, y, val, date: recentDates[recentDates.length - 1 - i]};
    });

    const polylinePoints = pointsArr.map(p => `${p.x},${p.y}`).join(' ');

    container.innerHTML = `
        <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:auto; overflow: visible;">
            <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#ff6b00" stop-opacity="0.1"/>
                    <stop offset="100%" stop-color="#ff6b00" stop-opacity="0"/>
                </linearGradient>
            </defs>
            <polyline points="${paddingX},${height-bottomSpace} ${polylinePoints} ${width-paddingX},${height-bottomSpace}" fill="url(#grad)" stroke="none" />
            <polyline points="${polylinePoints}" fill="none" stroke="#ff6b00" stroke-width="2" />
            
            ${pointsArr.map((p, i) => {
                // --- 核心改进：数字水平放，但奇偶点高度不同，彻底避开重叠 ---
                const isEven = i % 2 === 0;
                const yOffset = isEven ? 12 : 28; // 偶数点近，奇数点远
                const lineOpacity = isEven ? 0.3 : 0.15; // 辅助线深浅交错
                
                return `
                    <circle cx="${p.x}" cy="${p.y}" r="2.5" fill="#fff" stroke="#ff6b00" stroke-width="1.5" />
                    
                    <!-- 辅助引线：连接点和数字，让对应关系更明确 -->
                    <line x1="${p.x}" y1="${p.y}" x2="${p.x}" y2="${p.y - yOffset + 8}" stroke="#ff6b00" stroke-width="0.5" stroke-dasharray="2" opacity="0.5" />
                    
                    <!-- 水平数字：正着放，看起来最舒服 -->
                    <text x="${p.x}" y="${p.y - yOffset}" font-size="9" fill="#ff6b00" font-weight="bold" text-anchor="middle">${p.val}</text>
                    
                    <!-- 日期倾斜：日期字符多，必须倾斜，但数字正了就好看了 -->
                    <g transform="translate(${p.x}, ${height - bottomSpace + 12})">
                        <text transform="rotate(45)" font-size="9" fill="#999" text-anchor="start">${p.date.slice(5)}</text>
                    </g>

                    <!-- 背景垂直参考线 -->
                    <line x1="${p.x}" y1="${p.y}" x2="${p.x}" y2="${height - bottomSpace}" stroke="#eee" stroke-width="0.5" opacity="${lineOpacity}" />
                `;
            }).join('')}
            
            <line x1="${paddingX}" y1="${height-bottomSpace}" x2="${width-paddingX}" y2="${height-bottomSpace}" stroke="#ccc" />
        </svg>`;
}

// 启动
initHistoryApp();
