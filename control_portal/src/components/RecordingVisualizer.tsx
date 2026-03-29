import { useEffect, useState, useRef, useMemo } from 'react';
import { api, type Recording } from '../services/api';
import { Play, Pause, Save, Trash2, RotateCcw, HardDrive } from 'lucide-react';

// A single row from the data
interface DataRow {
    time_sec: number;
    sample: number;
    hand: string;
    isTracked: boolean;
    jointId: string | number;
    isValid: boolean;
    pos_x: number;
    pos_y: number;
    pos_z: number;
}

// Grouped by sample index (frame)
interface FrameData {
    sample: number;
    joints: DataRow[];
}

// Simple CSV parser for structured recording data
function parseCsv(csvText: string): DataRow[] {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const row: Record<string, any> = {};
        headers.forEach((h, i) => { row[h] = values[i]; });
        return {
            time_sec: Number(row.time_sec) || 0,
            sample: Number(row.sample) || 0,
            hand: String(row.hand || ''),
            isTracked: row.isTracked === 'true' || row.isTracked === 'True' || row.isTracked === '1',
            jointId: row.jointId ?? '',
            isValid: row.isValid === 'true' || row.isValid === 'True' || row.isValid === '1',
            pos_x: Number(row.pos_x) || 0,
            pos_y: Number(row.pos_y) || 0,
            pos_z: Number(row.pos_z) || 0,
        } as DataRow;
    });
}

export default function RecordingVisualizer({ recordingId }: { recordingId: string }) {
    const [recording, setRecording] = useState<Recording | null>(null);
    const [frames, setFrames] = useState<FrameData[]>([]);
    const [loading, setLoading] = useState(true);

    // Playback state
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
    const [isPlayAll, setIsPlayAll] = useState(false);

    // Trimming State
    const [selectedLength, setSelectedLength] = useState<number>(60); // 30, 60, 90
    const [trimStartIndex, setTrimStartIndex] = useState<number>(0);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const sideCanvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                // Fetch recording metadata and presigned URL in parallel
                const [recRes, dataRes] = await Promise.all([
                    api.getRecording(recordingId),
                    api.getRecordingData(recordingId) // defaults to 'url', returns presigned URL
                ]);

                if (!active) return;
                setRecording(recRes.recording);

                // Fetch the CSV file directly from the presigned URL
                const csvResponse = await fetch(dataRes.downloadUrl);
                if (!csvResponse.ok) throw new Error('Failed to fetch CSV from presigned URL');
                const csvText = await csvResponse.text();

                // Parse CSV into DataRow array
                const rawData = parseCsv(csvText);
                const framesMap = new Map<number, DataRow[]>();

                rawData.forEach(row => {
                    const sample = Number(row.sample) || 0;
                    if (!framesMap.has(sample)) framesMap.set(sample, []);
                    framesMap.get(sample)!.push(row);
                });

                const sortedFrames = Array.from(framesMap.entries())
                    .map(([sample, joints]) => ({ sample, joints }))
                    .sort((a, b) => a.sample - b.sample);

                setFrames(sortedFrames);

                // Setup initial trim windows
                if (recRes.recording.trimStartFrame !== undefined) {
                    setTrimStartIndex(recRes.recording.trimStartFrame);
                }
                if (recRes.recording.selectedFrameLength) {
                    setSelectedLength(recRes.recording.selectedFrameLength);
                }
            } catch (e) {
                console.error("Failed to load visualizer data", e);
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, [recordingId]);

    // Handle Playback loop
    useEffect(() => {
        let animationFrameId: number;
        let lastTime = 0;
        // targeting 30fps = ~33.3ms per frame
        const fpsInterval = 44.4;
        const totalFrames = frames.length;

        const renderLoop = (time: number) => {
            if (isPlaying) {
                if (!lastTime) lastTime = time;
                const elapsed = time - lastTime;

                if (elapsed > fpsInterval) {
                    lastTime = time - (elapsed % fpsInterval);
                    setCurrentFrameIndex(prev => {
                        const next = prev + 1;
                        if (isPlayAll) {
                            // Play all: loop through entire recording
                            return next >= totalFrames ? 0 : next;
                        }
                        // Play only within trim boundaries
                        return next >= trimStartIndex + selectedLength ? trimStartIndex : next;
                    });
                }
            }
            animationFrameId = requestAnimationFrame(renderLoop);
        };

        animationFrameId = requestAnimationFrame(renderLoop);
        return () => cancelAnimationFrame(animationFrameId);
    }, [isPlaying, isPlayAll, trimStartIndex, selectedLength, frames.length]);

    // Restart when selectedLength or trimStart changes
    useEffect(() => {
        setCurrentFrameIndex(trimStartIndex);
    }, [trimStartIndex, selectedLength]);

    // ---- Shared drawing function for both views ----
    const drawHandView = (
        canvas: HTMLCanvasElement,
        frameObj: FrameData,
        getXCoord: (j: DataRow) => number,
        getYCoord: (j: DataRow) => number,
        viewLabel: string
    ) => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Background
        ctx.fillStyle = '#fafafa';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Subtle grid
        ctx.strokeStyle = '#f0f0f0';
        ctx.lineWidth = 1;
        for (let gx = 0; gx < canvas.width; gx += 40) {
            ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, canvas.height); ctx.stroke();
        }
        for (let gy = 0; gy < canvas.height; gy += 40) {
            ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(canvas.width, gy); ctx.stroke();
        }

        const validJoints = frameObj.joints.filter(j => j.isValid && j.isTracked);
        if (validJoints.length === 0) {
            ctx.fillStyle = '#999';
            ctx.font = '16px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('此幀無有效追蹤資料', canvas.width / 2, canvas.height / 2);
            return;
        }

        // ---- Auto-fit: compute bounding box of all valid joints ----
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        validJoints.forEach(j => {
            const xVal = getXCoord(j);
            const yVal = getYCoord(j);
            minX = Math.min(minX, xVal);
            maxX = Math.max(maxX, xVal);
            minY = Math.min(minY, yVal);
            maxY = Math.max(maxY, yVal);
        });

        const dataW = maxX - minX || 0.001;
        const dataH = maxY - minY || 0.001;
        const dataCx = (minX + maxX) / 2;
        const dataCy = (minY + maxY) / 2;

        const padding = 80;
        const availW = canvas.width - padding * 2;
        const availH = canvas.height - padding * 2;
        const scale = Math.min(availW / dataW, availH / dataH);

        const toCanvas = (x: number, y: number): [number, number] => {
            const px = canvas.width / 2 + (x - dataCx) * scale;
            const py = canvas.height / 2 - (y - dataCy) * scale;
            return [px, py];
        };

        // ---- Skeletal bone connections ----
        const bones: [string, string][] = [
            ['Wrist', 'ThumbMetacarpal'], ['ThumbMetacarpal', 'ThumbProximal'], ['ThumbProximal', 'ThumbDistal'], ['ThumbDistal', 'ThumbTip'],
            ['Wrist', 'IndexMetacarpal'], ['IndexMetacarpal', 'IndexProximal'], ['IndexProximal', 'IndexIntermediate'], ['IndexIntermediate', 'IndexDistal'], ['IndexDistal', 'IndexTip'],
            ['Wrist', 'MiddleMetacarpal'], ['MiddleMetacarpal', 'MiddleProximal'], ['MiddleProximal', 'MiddleIntermediate'], ['MiddleIntermediate', 'MiddleDistal'], ['MiddleDistal', 'MiddleTip'],
            ['Wrist', 'RingMetacarpal'], ['RingMetacarpal', 'RingProximal'], ['RingProximal', 'RingIntermediate'], ['RingIntermediate', 'RingDistal'], ['RingDistal', 'RingTip'],
            ['Wrist', 'LittleMetacarpal'], ['LittleMetacarpal', 'LittleProximal'], ['LittleProximal', 'LittleIntermediate'], ['LittleIntermediate', 'LittleDistal'], ['LittleDistal', 'LittleTip'],
            ['IndexMetacarpal', 'MiddleMetacarpal'], ['MiddleMetacarpal', 'RingMetacarpal'], ['RingMetacarpal', 'LittleMetacarpal'],
            ['ForearmArm', 'Wrist'],
        ];

        const fingerChains: string[][] = [
            ['ThumbMetacarpal', 'ThumbProximal', 'ThumbDistal', 'ThumbTip'],
            ['IndexMetacarpal', 'IndexProximal', 'IndexIntermediate', 'IndexDistal', 'IndexTip'],
            ['MiddleMetacarpal', 'MiddleProximal', 'MiddleIntermediate', 'MiddleDistal', 'MiddleTip'],
            ['RingMetacarpal', 'RingProximal', 'RingIntermediate', 'RingDistal', 'RingTip'],
            ['LittleMetacarpal', 'LittleProximal', 'LittleIntermediate', 'LittleDistal', 'LittleTip'],
        ];

        const tipJoints = new Set(['ThumbTip', 'IndexTip', 'MiddleTip', 'RingTip', 'LittleTip']);
        const palmVertices = ['Wrist', 'ThumbMetacarpal', 'IndexMetacarpal', 'MiddleMetacarpal', 'RingMetacarpal', 'LittleMetacarpal'];

        const handColors: Record<string, { skin: string; skinLight: string; bone: string; joint: string; jointHighlight: string; label: string }> = {
            left: {
                skin: 'rgba(255, 160, 100, 0.55)',
                skinLight: 'rgba(255, 180, 130, 0.35)',
                bone: 'rgba(200, 100, 50, 0.45)',
                joint: 'rgba(220, 90, 30, 0.9)',
                jointHighlight: 'rgba(255, 200, 160, 0.7)',
                label: '左手',
            },
            right: {
                skin: 'rgba(16, 185, 129, 0.5)',
                skinLight: 'rgba(100, 220, 180, 0.3)',
                bone: 'rgba(10, 130, 90, 0.4)',
                joint: 'rgba(10, 160, 110, 0.9)',
                jointHighlight: 'rgba(150, 240, 210, 0.7)',
                label: '右手',
            },
        };

        // Group joints by hand
        const handGroups = new Map<string, Map<string, DataRow>>();
        validJoints.forEach(j => {
            const rawHand = j.hand.toLowerCase();
            const hand = rawHand === 'l' ? 'left' : rawHand === 'r' ? 'right' : rawHand;
            if (!handGroups.has(hand)) handGroups.set(hand, new Map());
            handGroups.get(hand)!.set(String(j.jointId), j);
        });

        // Draw each hand
        handGroups.forEach((jointMap, hand) => {
            const colors = handColors[hand] || handColors.right;

            const getPos = (name: string): [number, number] | null => {
                const j = jointMap.get(name);
                return j ? toCanvas(getXCoord(j), getYCoord(j)) : null;
            };

            // === Layer 1: Filled palm area ===
            const palmPoints: [number, number][] = [];
            palmVertices.forEach(name => {
                const p = getPos(name);
                if (p) palmPoints.push(p);
            });
            if (palmPoints.length >= 3) {
                ctx.fillStyle = colors.skinLight;
                ctx.beginPath();
                ctx.moveTo(palmPoints[0][0], palmPoints[0][1]);
                palmPoints.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
                ctx.closePath();
                ctx.fill();
            }

            // === Layer 2: Thick fleshy finger tubes ===
            fingerChains.forEach(chain => {
                const points: [number, number][] = [];
                chain.forEach(name => {
                    const p = getPos(name);
                    if (p) points.push(p);
                });
                if (points.length < 2) return;

                ctx.lineWidth = 16;
                ctx.strokeStyle = colors.skin;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.beginPath();
                ctx.moveTo(points[0][0], points[0][1]);
                points.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
                ctx.stroke();

                ctx.lineWidth = 8;
                ctx.strokeStyle = colors.skinLight;
                ctx.beginPath();
                ctx.moveTo(points[0][0], points[0][1]);
                points.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
                ctx.stroke();
            });

            // === Forearm tube ===
            {
                const forearmPoints: [number, number][] = [];
                ['ForearmArm', 'Wrist'].forEach(name => {
                    const p = getPos(name);
                    if (p) forearmPoints.push(p);
                });
                if (forearmPoints.length === 2) {
                    ctx.lineWidth = 24;
                    ctx.strokeStyle = colors.skin;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(forearmPoints[0][0], forearmPoints[0][1]);
                    ctx.lineTo(forearmPoints[1][0], forearmPoints[1][1]);
                    ctx.stroke();

                    ctx.lineWidth = 14;
                    ctx.strokeStyle = colors.skinLight;
                    ctx.beginPath();
                    ctx.moveTo(forearmPoints[0][0], forearmPoints[0][1]);
                    ctx.lineTo(forearmPoints[1][0], forearmPoints[1][1]);
                    ctx.stroke();
                }
            }

            // === Layer 3: Rounded fingertip caps ===
            tipJoints.forEach(tipName => {
                const p = getPos(tipName);
                if (!p) return;
                ctx.beginPath();
                ctx.arc(p[0], p[1], 9, 0, Math.PI * 2);
                ctx.fillStyle = colors.skin;
                ctx.fill();
            });

            // === Layer 4: Structural bone lines ===
            ctx.lineWidth = 2;
            ctx.strokeStyle = colors.bone;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            bones.forEach(([fromName, toName]) => {
                const from = getPos(fromName);
                const to = getPos(toName);
                if (!from || !to) return;
                ctx.beginPath();
                ctx.moveTo(from[0], from[1]);
                ctx.lineTo(to[0], to[1]);
                ctx.stroke();
            });

            // === Layer 5: Joint dots ===
            jointMap.forEach((j, id) => {
                const [px, py] = toCanvas(getXCoord(j), getYCoord(j));

                const isTip = tipJoints.has(id);
                const radius = isTip ? 5 : 3.5;

                ctx.beginPath();
                ctx.arc(px, py, radius, 0, Math.PI * 2);
                ctx.fillStyle = colors.joint;
                ctx.fill();

                ctx.beginPath();
                ctx.arc(px - 0.8, py - 0.8, radius * 0.4, 0, Math.PI * 2);
                ctx.fillStyle = colors.jointHighlight;
                ctx.fill();
            });

            // === Hand label near wrist ===
            const wristPos = getPos('Wrist');
            if (wristPos) {
                ctx.fillStyle = colors.joint;
                ctx.font = 'bold 13px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(colors.label, wristPos[0], wristPos[1] + 28);
            }
        });

        // View label (top-left)
        ctx.fillStyle = '#555';
        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(viewLabel, 16, 24);

        // Frame counter
        ctx.fillStyle = '#888';
        ctx.font = '13px Inter, sans-serif';
        ctx.fillText(`Frame: ${currentFrameIndex} | Sample: ${frameObj.sample}`, 16, 44);

        // Legend
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(220, 90, 30, 0.9)';
        ctx.fillText('● 左手', canvas.width - 16, 24);
        ctx.fillStyle = 'rgba(10, 160, 110, 0.9)';
        ctx.fillText('● 右手', canvas.width - 16, 44);
    };

    // Draw both views on frame change
    useEffect(() => {
        if (frames.length === 0) return;
        const frameObj = frames[Math.min(currentFrameIndex, frames.length - 1)];
        if (!frameObj) return;

        // Front view — X / Y
        if (canvasRef.current) {
            drawHandView(canvasRef.current, frameObj, j => j.pos_x, j => j.pos_y, '正面 (X / Y)');
        }
        // Side view — Z / Y
        if (sideCanvasRef.current) {
            drawHandView(sideCanvasRef.current, frameObj, j => j.pos_z, j => j.pos_y, '側面 (Z / Y)');
        }
    }, [currentFrameIndex, frames]);

    const handleSaveTrim = async () => {
        try {
            await api.trimRecording(recordingId, {
                trimStartFrame: trimStartIndex,
                trimEndFrame: trimStartIndex + selectedLength,
                selectedFrameLength: selectedLength
            });
            alert('已更新固定長度框框片段');
        } catch (e) {
            alert('更新失敗');
        } finally {
            try {
                await api.editingCompleted(recordingId);
            } catch (notifyError) {
                console.error('Failed to notify editing completed:', notifyError);
            }
        }
    };

    const handleSoftDelete = async () => {
        if (!window.confirm("確定要把這組數據標記為軟刪除嗎？")) return;
        try {
            await api.deleteRecording(recordingId);
            alert('已更新為不保留狀態');
        } catch (e) {
            alert('更新失敗');
        } finally {
            try {
                await api.editingCompleted(recordingId);
            } catch (notifyError) {
                console.error('Failed to notify editing completed:', notifyError);
            }
        }
    };

    const handleStash = async () => {
        try {
            await api.editingCompleted(recordingId);
            alert('已暫存，目前未套用剪輯也未拋棄');
        } catch (e) {
            alert('暫存通知失敗');
        }
    };

    const untrackedInfo = useMemo(() => {
        const left: number[] = [];
        const right: number[] = [];
        frames.forEach((f, idx) => {
            let leftTracked = false;
            let rightTracked = false;
            f.joints.forEach(j => {
                const h = j.hand.toLowerCase();
                if ((h === 'l' || h === 'left') && j.isValid && j.isTracked) leftTracked = true;
                if ((h === 'r' || h === 'right') && j.isValid && j.isTracked) rightTracked = true;
            });
            if (!leftTracked) left.push(idx);
            if (!rightTracked) right.push(idx);
        });
        return { left, right };
    }, [frames]);

    if (loading) return <div className="card" style={{ padding: '48px', textAlign: 'center' }}>載入中...</div>;
    if (!recording || frames.length === 0) return <div className="card" style={{ padding: '48px', textAlign: 'center' }}>無數據或是無法讀取</div>;

    const totalFramesAvailable = frames.length;
    // Make sure slider doesn't overflow
    const maxTrimStart = Math.max(0, totalFramesAvailable - selectedLength);
    const hasAnimation = Boolean(recording.enableAnimationRecording || recording.s3AnimKey);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            <div className="card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.92rem', color: 'var(--color-text-muted)' }}>描述:</span>
                    <span style={{ fontWeight: 600 }}>{recording.description?.trim() || '無描述'}</span>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.92rem', color: 'var(--color-text-muted)' }}>動畫:</span>
                    <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        borderRadius: '999px',
                        padding: '2px 10px',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        color: hasAnimation ? '#7c3aed' : 'var(--color-text-muted)',
                        backgroundColor: hasAnimation ? '#f3e8ff' : '#f3f4f6',
                    }}>
                        {hasAnimation ? '有動畫' : '無動畫'}
                    </span>
                </div>
            </div>

            {/* Visualizer Canvas Area — Front + Side */}
            <div className="card" style={{ padding: '16px', display: 'flex', gap: '16px', justifyContent: 'center', backgroundColor: '#fafafa', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 0', minWidth: '300px', maxWidth: '640px' }}>
                    <canvas
                        ref={canvasRef}
                        width={640}
                        height={480}
                        style={{ width: '100%', height: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}
                    />
                </div>
                <div style={{ flex: '1 1 0', minWidth: '300px', maxWidth: '640px' }}>
                    <canvas
                        ref={sideCanvasRef}
                        width={640}
                        height={480}
                        style={{ width: '100%', height: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}
                    />
                </div>
            </div>

            {/* Playback Controls */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
                    <button className="btn-secondary" onClick={() => { setIsPlaying(false); setIsPlayAll(false); setCurrentFrameIndex(trimStartIndex); }}>
                        <RotateCcw size={20} /> 重設片段
                    </button>

                    <button className="btn-primary" onClick={() => {
                        if (isPlaying) {
                            setIsPlaying(false);
                        } else {
                            setIsPlayAll(false);
                            setCurrentFrameIndex(trimStartIndex);
                            setIsPlaying(true);
                        }
                    }}>
                        {isPlaying ? <><Pause size={20} /> 暫停</> : <><Play size={20} /> 播放片段</>}
                    </button>

                    <button className="btn-secondary" onClick={() => {
                        setIsPlayAll(true);
                        setCurrentFrameIndex(0);
                        setIsPlaying(true);
                    }}>
                        <Play size={20} /> 從頭到尾
                    </button>
                </div>

                {/* Timeline Trimming Controls */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', alignItems: 'center' }}>
                        <h4 style={{ fontWeight: 600 }}>剪輯與框列 (拖曳決定哪一個片段)</h4>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>框列長度:</span>
                            <select
                                value={selectedLength}
                                onChange={(e) => {
                                    const len = Number(e.target.value);
                                    setSelectedLength(len);
                                    if (trimStartIndex + len > totalFramesAvailable) {
                                        setTrimStartIndex(Math.max(0, totalFramesAvailable - len));
                                    }
                                }}
                                style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                            >
                                <option value={30}>30 幀 (1秒)</option>
                                <option value={60}>60 幀 (2秒)</option>
                                <option value={90}>90 幀 (3秒)</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ position: 'relative', height: '40px', backgroundColor: '#e5e7eb', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                        <input
                            type="range"
                            min={0}
                            max={maxTrimStart}
                            value={trimStartIndex}
                            onChange={(e) => setTrimStartIndex(Number(e.target.value))}
                            style={{
                                position: 'absolute', width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 10
                            }}
                        />

                        {/* Background total length visual */}
                        <div style={{
                            position: 'absolute', top: 0, bottom: 0,
                            left: `${(trimStartIndex / totalFramesAvailable) * 100}%`,
                            width: `${(selectedLength / totalFramesAvailable) * 100}%`,
                            backgroundColor: 'var(--color-primary-light)',
                            border: '2px solid var(--color-primary)',
                            boxSizing: 'border-box',
                            pointerEvents: 'none',
                            borderRadius: 'var(--radius-md)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-primary)' }}>保留區間</span>
                        </div>

                        {/* Playhead */}
                        <div style={{
                            position: 'absolute', top: 0, bottom: 0,
                            left: `${(currentFrameIndex / totalFramesAvailable) * 100}%`,
                            width: '2px', backgroundColor: 'var(--color-danger)',
                            pointerEvents: 'none', zIndex: 5
                        }}></div>
                    </div>

                    {/* Untracked hand indicators */}
                    <div style={{ position: 'relative', height: '12px', marginTop: '6px', marginBottom: '14px' }}>
                        {untrackedInfo.left.map(frameIdx => (
                            <div key={`l-${frameIdx}`} style={{
                                position: 'absolute', top: 0,
                                left: `${(frameIdx / totalFramesAvailable) * 100}%`,
                                width: '4px', height: '4px', borderRadius: '50%',
                                backgroundColor: 'rgba(220, 90, 30, 0.9)'
                            }} title={`左手遺失 (Frame ${frameIdx})`} />
                        ))}
                        {untrackedInfo.right.map(frameIdx => (
                            <div key={`r-${frameIdx}`} style={{
                                position: 'absolute', top: '8px',
                                left: `${(frameIdx / totalFramesAvailable) * 100}%`,
                                width: '4px', height: '4px', borderRadius: '50%',
                                backgroundColor: 'rgba(10, 160, 110, 0.9)'
                            }} title={`右手遺失 (Frame ${frameIdx})`} />
                        ))}
                        <div style={{ position: 'absolute', right: 0, top: '-2px', fontSize: '0.7rem', color: 'rgba(220, 90, 30, 0.9)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'rgba(220, 90, 30, 0.9)' }}></div> 左手遺失
                        </div>
                        <div style={{ position: 'absolute', right: 0, top: '8px', fontSize: '0.7rem', color: 'rgba(10, 160, 110, 0.9)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'rgba(10, 160, 110, 0.9)' }}></div> 右手遺失
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                        <span>0</span>
                        <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                            目前選取起點: {trimStartIndex} ~ {trimStartIndex + selectedLength}
                        </span>
                        <span>{totalFramesAvailable} 幀</span>
                    </div>

                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
                <button className="btn-secondary" style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={handleSoftDelete}>
                    <Trash2 size={16} /> 拋棄
                </button>
                <button className="btn-secondary" style={{ color: '#2563eb', borderColor: '#2563eb' }} onClick={handleStash}>
                    <HardDrive size={16} /> 暫存
                </button>
                <button className="btn-primary" onClick={handleSaveTrim}>
                    <Save size={16} /> 剪輯
                </button>
            </div>

        </div>
    );
}
