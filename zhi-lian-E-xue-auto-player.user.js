// ==UserScript==
// @name         智联E学自动刷课助手
// @version      1.0
// @description  智联E学自动识别目录、自动翻页、分配课时,高效刷课工具
// @author       UXU倒計時
// @match        https://course.zhaopin.com/*
// @icon         https://course.zhaopin.com/favicon.ico
// @grant        none
// @run-at       document-end
// @homepage     https://github.com/Brandonjhd/ZhiLianEXueAutoPlayer
// @supportURL   https://github.com/Brandonjhd/ZhiLianEXueAutoPlayer/issues
// @license      CC-BY-NC-SA-4.0
// ==/UserScript==

(function () {
    'use strict';

    if (window.__courseHelperInjected) return;
    window.__courseHelperInjected = true;

    let currentPlayWorker = null;

    function getCourseList() {
        let nodes = [];
        let chapterLists = document.querySelectorAll('.courseCatalogueListItem');
        chapterLists.forEach((item, idx1) => {
            let chapterName = item.querySelector('.headWord')?.innerText.replace(/\s+/g,' ').trim() || `章节${idx1+1}`;
            let cons = item.querySelectorAll('.courseCatalogueCon');
            cons.forEach((con, idx2) => {
                let nameP = con.querySelector('p');
                let lessonName = nameP?.innerText.trim() || `课程${idx2+1}`;
                let percentSpan = con.querySelector('span:last-child');
                let percent = percentSpan ? percentSpan.innerText : '';
                let active = con.classList.contains('active');
                let courseId = `${chapterName}|${lessonName}`;
                nodes.push({
                    chapterIdx: idx1,
                    idx: idx2,
                    chapter: chapterName,
                    name: lessonName,
                    percent: percent,
                    active: active,
                    node: con,
                    courseId: courseId,
                    percentNum: getPercentNum(percent)
                });
            });
        });
        return nodes;
    }

    function getPercentNum(percent) {
        if (!percent || typeof percent !== 'string') return 0;
        let match = percent.match(/([\d]+)/);
        if (!match) return 0;
        return parseInt(match[1],10);
    }

    function stopCurrentWorker() {
        if (currentPlayWorker && typeof currentPlayWorker.abort === 'function') {
            currentPlayWorker.abort();
        }
        currentPlayWorker = null;
    }

    function truncateStatus(text, maxLen) {
        if (typeof text !== "string") return "";
        if (text.length <= maxLen) return text;
        return text.slice(0, maxLen) + "...";
    }

    function renderPanel(courseFlatList) {
        let old = document.getElementById('zhaopinexue-panel');
        if (old) old.remove();

        let panel = document.createElement('div');
        panel.id = 'zhaopinexue-panel';
        panel.style.position = 'fixed';
        panel.style.right = '20px';
        panel.style.bottom = '90px';
        panel.style.width = '380px';
        panel.style.background = 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)';
        panel.style.border = 'none';
        panel.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3)';
        panel.style.borderRadius = '16px';
        panel.style.zIndex = '99999';
        panel.style.fontFamily = 'sans-serif';
        panel.style.padding = '20px';
        panel.style.display = 'block';

        let title = document.createElement('div');
        title.innerHTML = '🎓 智联E学自动刷课助手';
        title.style.fontSize = '18px';
        title.style.fontWeight = 'bold';
        title.style.color = '#fff';
        title.style.marginBottom = '8px';
        title.style.textAlign = 'center';

        let authorInfo = document.createElement('div');
        authorInfo.style.display = 'flex';
        authorInfo.style.alignItems = 'center';
        authorInfo.style.justifyContent = 'space-between';
        authorInfo.style.marginBottom = '2px';
        authorInfo.style.paddingBottom = '2px';

        let authorText = document.createElement('p');
        authorText.textContent = '作者: UXU倒計時';
        authorText.style.margin = '0';
        authorText.style.margin = '2px 0';
        authorText.style.fontSize = '12px';
        authorText.style.color = 'rgba(255,255,255,0.9)';

        let githubLink = document.createElement('a');
        githubLink.href = 'https://github.com/Brandonjhd/ZhiLianEXueAutoPlayer';
        githubLink.textContent = '📦 GitHub仓库';
        authorText.style.margin = '2px 0';
        githubLink.style.fontSize = '12px';
        githubLink.style.color = '#fff';

        authorInfo.appendChild(authorText);
        authorInfo.appendChild(githubLink);

        let contentBox = document.createElement('div');
        contentBox.style.background = '#fff';
        contentBox.style.borderRadius = '12px';
        contentBox.style.padding = '16px';
        contentBox.style.boxSizing = 'border-box';

        let selectorLabel = document.createElement('label');
        selectorLabel.innerHTML = '📖 选择起始课程:';
        selectorLabel.style.display = 'block';
        selectorLabel.style.fontSize = '14px';
        selectorLabel.style.fontWeight = '600';
        selectorLabel.style.color = '#333';
        selectorLabel.style.marginBottom = '8px';

        let selectWrap = document.createElement('div');
        selectWrap.style.display = 'flex';
        selectWrap.style.alignItems = 'center';
        selectWrap.style.justifyContent = 'center';
        selectWrap.style.margin = '12px 0 18px 0';

        let lessonSelect = document.createElement('select');
        lessonSelect.id = 'zhaopinexue-select';
        lessonSelect.style.width = '100%';
        lessonSelect.style.padding = '8px';
        lessonSelect.style.borderRadius = '8px';
        lessonSelect.style.border = '2px solid #e0e0e0';
        lessonSelect.style.fontSize = '13px';
        lessonSelect.style.background = '#f9f7ff';

        let firstSelected = false;
        courseFlatList.forEach((lesson, idx) => {
            let op = document.createElement('option');
            op.value = lesson.courseId;
            op.textContent = `${lesson.chapter} - ${lesson.name} (${lesson.percent})`;
            if (!firstSelected && lesson.active) {
                op.selected = true;
                firstSelected = true;
            }
            lessonSelect.appendChild(op);
        });

        selectWrap.appendChild(lessonSelect);

        if (lessonSelect.options.length === 0) {
            let warn = document.createElement('div');
            warn.style.color = '#ce2550';
            warn.textContent = '未检测到课程目录，请刷新页面后重试！';
            warn.style.marginBottom = '10px';
            contentBox.appendChild(warn);
        }

        let btnContainer = document.createElement('div');
        btnContainer.style.display = 'flex';
        btnContainer.style.gap = '10px';
        btnContainer.style.marginBottom = '15px';

        let startBtn = document.createElement('button');
        startBtn.textContent = '🚀 开始刷课';
        startBtn.style.flex = '1';
        startBtn.style.padding = '12px';
        startBtn.style.background = 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)';
        startBtn.style.color = '#fff';
        startBtn.style.borderRadius = '8px';
        startBtn.style.border = 'none';
        startBtn.style.fontSize = '15px';
        startBtn.style.fontWeight = 'bold';
        startBtn.style.cursor = 'pointer';
        startBtn.style.transition = 'all 0.3s ease';

        let status = document.createElement('div');
        status.id = 'zhaopinexue-status';
        status.style.marginTop = '9px';
        status.style.height = '26px';
        status.style.overflow = 'hidden';
        status.style.fontSize = '13px';
        status.style.lineHeight = '26px';
        status.style.background = '#f9f9f9';
        status.style.border = '2px solid #e0e0e0';
        status.style.padding = '0 10px';
        status.style.borderRadius = '8px';
        status.style.fontFamily = 'monospace';
        status.style.color = '#555';
        status.textContent = '';

        btnContainer.appendChild(startBtn);

        let startPlayTask = function(selectedCourseId) {
            stopCurrentWorker();
            startBtn.disabled = true;
            status.textContent = truncateStatus("🟣 正在开始刷课...", 36);

            let selIdx = courseFlatList.findIndex(v => v.courseId === selectedCourseId);
            if (selIdx < 0) {
                status.textContent = truncateStatus('课程索引错误，请重试！', 36);
                startBtn.disabled = false;
                return;
            }
            let taskQueue = [];
            for (let i = selIdx; i < courseFlatList.length; i++) {
                let percentVal = courseFlatList[i].percentNum;
                if (percentVal >= 100) continue;
                taskQueue.push(courseFlatList[i]);
            }
            let stopFlag = { abort() { this.aborted = true; }, aborted: false, isPlaying: true };
            currentPlayWorker = stopFlag;
            let playNext = async function(idx){
                if (stopFlag.aborted) {
                    stopFlag.isPlaying = false;
                    startBtn.disabled = false;
                    status.textContent = '';
                    return;
                }
                if (idx >= taskQueue.length) {
                    stopFlag.isPlaying = false;
                    status.textContent = truncateStatus('🎉 全部刷课完成，祝贺！', 36);
                    startBtn.disabled = false;
                    return;
                }
                let item = taskQueue[idx];
                let playingStr = `🎬 正在播放: ${item.name}`;
                status.textContent = truncateStatus(playingStr, 36);
                item.node.querySelector('p')?.click();
                let tryVideo = 0, videoEl = null;
                while (tryVideo++ < 20 && !stopFlag.aborted) {
                    videoEl = document.querySelector('video');
                    if (videoEl) break;
                    await new Promise(res => setTimeout(res, 500));
                }
                if (stopFlag.aborted) {
                    stopFlag.isPlaying = false;
                    startBtn.disabled = false;
                    status.textContent = '';
                    return;
                }
                if (!videoEl) {
                    status.textContent = truncateStatus(`【${item.name}】找不到视频，跳过`, 36);
                    await new Promise(res=>setTimeout(res,700));
                    playNext(idx + 1);
                    return;
                }
                videoEl.muted = true;
                if (item.percentNum < 100) {
                    try {
                        videoEl.currentTime = 0;  // 不足100自动到最开始
                    } catch {}
                } else {
                    try {
                        let totalSec = videoEl.duration || 0;
                        if (!totalSec || isNaN(totalSec)) {
                            let timeLabel = document.querySelector('.vcp-timelabel');
                            if (timeLabel) {
                                let parts = timeLabel.innerText.split('/');
                                if (parts.length === 2) {
                                    let text = parts[1].trim();
                                    let seg = text.split(':').map(x=>parseInt(x));
                                    totalSec = seg.length === 3
                                        ? seg[0]*3600+seg[1]*60+seg[2]
                                        : seg.length === 2 ? seg[0]*60+seg[1]:0;
                                }
                            }
                        }
                        if (!totalSec || isNaN(totalSec)) totalSec = 60;
                        videoEl.currentTime = totalSec - 1;
                    } catch {}
                }
                videoEl.play();
                let waited = 0, fullWait = (videoEl.duration || 60) + 3;
                let ended = false;
                videoEl.onended = () => ended = true;
                while (!ended && waited < fullWait && !stopFlag.aborted) {
                    await new Promise(res => setTimeout(res, 1000));
                    waited++;
                }
                if (stopFlag.aborted) {
                    stopFlag.isPlaying = false;
                    startBtn.disabled = false;
                    status.textContent = '';
                    return;
                }
                playNext(idx+1);
            };
            playNext(0);
        };

        startBtn.onclick = function () {
            let selVal = lessonSelect.value;
            if (!selVal) {
                status.textContent = truncateStatus('请先选择起始课程', 36);
                return;
            }
            startPlayTask(selVal);
        };

        lessonSelect.onchange = function () {
            status.textContent = truncateStatus('准备刷课，点击开始', 36);
            stopCurrentWorker();
        };

        contentBox.appendChild(selectorLabel);
        contentBox.appendChild(selectWrap);
        contentBox.appendChild(btnContainer);
        contentBox.appendChild(status);

        panel.appendChild(title);
        panel.appendChild(authorInfo);
        panel.appendChild(contentBox);
        document.body.appendChild(panel);
    }

    const ball = document.createElement('div');
    ball.id = 'zhaopinexue-ball';
    ball.style.position = 'fixed';
    ball.style.bottom = '20px';
    ball.style.right = '20px';
    ball.style.width = '60px';
    ball.style.height = '60px';
    ball.style.borderRadius = '30px';
    ball.style.background = 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)';
    ball.style.zIndex = '99999';
    ball.style.boxShadow = '0 4px 15px rgba(102,126,234,0.4)';
    ball.style.display = 'flex';
    ball.style.justifyContent = 'center';
    ball.style.alignItems = 'center';
    ball.style.cursor = 'pointer';
    ball.style.fontSize = '30px';
    ball.style.transition = 'all 0.3s ease';
    ball.innerText = '🎓';
    ball.title = '点击展开智联E学自动刷课助手';

    ball.onmouseenter = function(){
        this.style.transform = 'scale(1.10)';
        this.style.boxShadow = '0 6px 20px rgba(102,126,234,0.6)';
    };
    ball.onmouseleave = function(){
        this.style.transform = 'scale(1)';
        this.style.boxShadow = '0 4px 15px rgba(102,126,234,0.4)';
    };

    document.body.appendChild(ball);

    ball.onclick = () => {
        let _panel = document.getElementById('zhaopinexue-panel');
        if(_panel){
            _panel.style.display = _panel.style.display === 'none' ? 'block' : 'none';
        } else {
            let chs = getCourseList();
            renderPanel(chs);
        }
    };

    document.addEventListener('mousedown', e => {
        let _panel = document.getElementById('zhaopinexue-panel');
        if (_panel && !(_panel.contains(e.target) || e.target === ball)) {
            _panel.style.display = 'none';
        }
    });
})();
