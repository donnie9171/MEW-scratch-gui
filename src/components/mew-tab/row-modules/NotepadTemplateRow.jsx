import React, {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {BiSolidNotepad} from 'react-icons/bi';
import {TbCalculatorFilled, TbBuildingBroadcastTowerFilled} from 'react-icons/tb';
import {RiRadarFill} from 'react-icons/ri';
import {TiMicrophone} from 'react-icons/ti';
import {FaIdCardAlt} from 'react-icons/fa';
import { FaNoteSticky } from "react-icons/fa6";

import {FaGears} from 'react-icons/fa6';
import {LuAudioWaveform} from 'react-icons/lu';
import styles from '../mew-tab.css';
import {
    createTextSegment,
    createTokenSegment,
    normalizeTemplateValue
} from './utils/notepadTemplateValue';

const createItemId = () => `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const SOURCE_NODE_COLOR_BY_TYPE = {
    receiver: '#ffab19',
    broadcaster: '#ffab19',
    agent: '#2499ff',
    variable: '#ff8c17',
    notepad: '#5ac05b',
    costume: '#9965ff',
    comment: '#ffe646',
    gate: '#ff4949',
    servo: '#4fccf3',
    audio: '#d062d2',
    microphone: '#ff1717'
};

const SOURCE_NODE_ICON_BY_TYPE = {
    receiver: RiRadarFill,
    broadcaster: TbBuildingBroadcastTowerFilled,
    agent: FaIdCardAlt,
    variable: TbCalculatorFilled,
    notepad: BiSolidNotepad,
    comment: FaNoteSticky,
    servo: FaGears,
    audio: LuAudioWaveform,
    microphone: TiMicrophone
};

const getSourceColor = sourceNodeType => {
    const key = String(sourceNodeType || '').trim().toLowerCase();
    return SOURCE_NODE_COLOR_BY_TYPE[key] || '#2499ff';
};

const getSourceIcon = sourceNodeType => {
    const key = String(sourceNodeType || '').trim().toLowerCase();
    return SOURCE_NODE_ICON_BY_TYPE[key] || null;
};

const toSourceLabel = source => (
    source?.label || source?.sourceNodeType || source?.sourceNodeId || 'Source'
);

const normalizeListItems = value => {
    if (Array.isArray(value?.listItems)) {
        return value.listItems.map(item => {
            if (item && typeof item === 'object') {
                if (item.type === 'placeholder') {
                    return {
                        id: String(item.id || createItemId()),
                        type: 'placeholder',
                        sourceNodeId: String(item.sourceNodeId || ''),
                        sourcePortId: String(item.sourcePortId || 'out_value'),
                        label: String(item.label || toSourceLabel(item)),
                        sourceNodeType: String(item.sourceNodeType || ''),
                        resolverField: item.resolverField ? String(item.resolverField) : null
                    };
                }

                return {
                    id: String(item.id || createItemId()),
                    type: 'text',
                    content: typeof item.content === 'string' ? item.content : ''
                };
            }

            return {
                id: createItemId(),
                type: 'text',
                content: String(item || '')
            };
        });
    }

    const normalized = normalizeTemplateValue(value);
    const nextItems = [];
    let textBuffer = '';

    const flushText = () => {
        if (!textBuffer) return;
        nextItems.push({
            id: createItemId(),
            type: 'text',
            content: textBuffer
        });
        textBuffer = '';
    };

    normalized.segments.forEach(segment => {
        if (segment.type === 'text') {
            textBuffer += segment.text || '';
            return;
        }

        if (segment.type === 'token') {
            flushText();
            nextItems.push({
                id: createItemId(),
                type: 'placeholder',
                sourceNodeId: String(segment.sourceNodeId || ''),
                sourcePortId: String(segment.sourcePortId || 'out_value'),
                label: String(segment.alias || segment.label || segment.sourceNodeId || 'Source'),
                sourceNodeType: '',
                resolverField: segment.resolverField ? String(segment.resolverField) : null
            });
        }
    });

    flushText();
    return nextItems;
};

const toNextTemplateValue = (currentValue, listItems) => {
    const normalized = normalizeTemplateValue(currentValue);
    const segments = [];

    listItems.forEach((item, index) => {
        if (item.type === 'placeholder' && item.sourceNodeId) {
            segments.push(createTokenSegment({
                sourceNodeId: item.sourceNodeId,
                sourcePortId: item.sourcePortId || 'out_value',
                label: item.label || toSourceLabel(item),
                resolverField: item.resolverField || null
            }));
        } else {
            segments.push(createTextSegment(item.content || ''));
        }

        if (index < listItems.length - 1) {
            segments.push(createTextSegment('\n'));
        }
    });

    return {
        ...normalized,
        listItems,
        segments: segments.length ? segments : [createTextSegment('')]
    };
};

const buildSegmentSignatureFromListItems = listItems => {
    const signature = [];

    listItems.forEach((item, index) => {
        if (item.type === 'placeholder' && item.sourceNodeId) {
            signature.push({
                type: 'token',
                sourceNodeId: String(item.sourceNodeId || ''),
                sourcePortId: String(item.sourcePortId || 'out_value'),
                label: String(item.label || toSourceLabel(item)),
                alias: '',
                resolverField: item.resolverField ? String(item.resolverField) : null
            });
        } else {
            signature.push({
                type: 'text',
                text: String(item.content || '')
            });
        }

        if (index < listItems.length - 1) {
            signature.push({type: 'text', text: '\n'});
        }
    });

    return signature;
};

const buildSegmentSignatureFromTemplate = templateValue => (
    normalizeTemplateValue(templateValue).segments.map(seg => {
        if (seg.type === 'text') {
            return {type: 'text', text: String(seg.text || '')};
        }

        return {
            type: 'token',
            sourceNodeId: String(seg.sourceNodeId || ''),
            sourcePortId: String(seg.sourcePortId || 'out_value'),
            label: String(seg.label || ''),
            alias: String(seg.alias || ''),
            resolverField: seg.resolverField ? String(seg.resolverField) : null
        };
    })
);

const syncPlaceholdersWithSources = (listItems, sourceOptions) => {
    const sourceByKey = new Map(
        sourceOptions.map(source => [
            `${source.sourceNodeId || ''}:${source.sourcePortId || 'out_value'}`,
            source
        ])
    );

    let changed = false;

    const nextItems = listItems.reduce((acc, item) => {
        if (item.type !== 'placeholder') {
            acc.push(item);
            return acc;
        }

        const key = `${item.sourceNodeId || ''}:${item.sourcePortId || 'out_value'}`;
        const latestSource = sourceByKey.get(key);

        // If upstream source was deleted/disconnected, drop this placeholder to avoid stale refs.
        if (!latestSource) {
            changed = true;
            return acc;
        }

        const nextLabel = latestSource.label || item.label || 'Source';
        const nextSourceNodeType = latestSource.sourceNodeType || '';
        const nextResolverField = latestSource.resolverField || null;

        if (
            nextLabel === item.label &&
            nextSourceNodeType === (item.sourceNodeType || '') &&
            nextResolverField === (item.resolverField || null)
        ) {
            acc.push(item);
            return acc;
        }

        changed = true;
        acc.push({
            ...item,
            label: nextLabel,
            sourceNodeType: nextSourceNodeType,
            resolverField: nextResolverField
        });
        return acc;
    }, []);

    return changed ? nextItems : listItems;
};

const reorderListItems = (items, dragId, overId, insertAfter) => {
    const fromIndex = items.findIndex(item => item.id === dragId);
    const overIndex = items.findIndex(item => item.id === overId);

    if (fromIndex < 0 || overIndex < 0) return items;
    if (dragId === overId) return items;

    const nextItems = items.slice();
    const [dragged] = nextItems.splice(fromIndex, 1);

    let toIndex = overIndex;
    if (insertAfter) {
        toIndex += 1;
    }

    if (fromIndex < overIndex) {
        toIndex -= 1;
    }

    nextItems.splice(Math.max(0, Math.min(nextItems.length, toIndex)), 0, dragged);
    return nextItems;
};

const areListItemsEqual = (left, right) => {
    if (left === right) return true;
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (left.length !== right.length) return false;

    for (let i = 0; i < left.length; i += 1) {
        const a = left[i];
        const b = right[i];

        if (!a || !b) return false;
        if (a.id !== b.id || a.type !== b.type) return false;

        if (a.type === 'placeholder') {
            if (
                String(a.sourceNodeId || '') !== String(b.sourceNodeId || '') ||
                String(a.sourcePortId || 'out_value') !== String(b.sourcePortId || 'out_value') ||
                String(a.label || '') !== String(b.label || '') ||
                String(a.sourceNodeType || '') !== String(b.sourceNodeType || '') ||
                (a.resolverField ? String(a.resolverField) : null) !==
                    (b.resolverField ? String(b.resolverField) : null)
            ) {
                return false;
            }
        } else if (String(a.content || '') !== String(b.content || '')) {
            return false;
        }
    }

    return true;
};

const NotepadListCell = ({
    item,
    index,
    placeholder,
    renderListCell,
    onDelete,
    onTextChange,
    onHandleDragStart,
    onHandleDragEnd,
    onCellDragOver,
    onCellDrop,
    isDragging,
    isDropBefore,
    isDropAfter
}) => {
    const classNames = [styles.notepadTemplateListCell];
    const textAreaRef = useRef(null);
    if (isDragging) classNames.push(styles.notepadTemplateListCellDragging);
    if (isDropBefore) classNames.push(styles.notepadTemplateListCellDropBefore);
    if (isDropAfter) classNames.push(styles.notepadTemplateListCellDropAfter);
    const customContent = typeof renderListCell === 'function' ? renderListCell({item, index}) : null;
    const PlaceholderIcon = getSourceIcon(item.sourceNodeType);

    useLayoutEffect(() => {
        if (item.type !== 'text') return;

        const el = textAreaRef.current;
        if (!el) return;

        const resizeToContent = () => {
            el.style.height = 'auto';
            el.style.height = `${el.scrollHeight}px`;
        };

        // Run now and again on next frame to catch late width/layout hydration.
        resizeToContent();
        const rafId = window.requestAnimationFrame(resizeToContent);
        const timerId = window.setTimeout(resizeToContent, 0);

        let observer = null;
        if (typeof ResizeObserver !== 'undefined') {
            observer = new ResizeObserver(() => {
                resizeToContent();
            });
            observer.observe(el);
        }

        window.addEventListener('resize', resizeToContent);

        return () => {
            window.cancelAnimationFrame(rafId);
            window.clearTimeout(timerId);
            if (observer) observer.disconnect();
            window.removeEventListener('resize', resizeToContent);
        };
    }, [item.id, item.content, item.type]);

    const handleTextInput = event => {
        const el = event.currentTarget;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
    };

    const handleCellDragStart = event => {
        event.stopPropagation();

        const dragHandleClass = styles.notepadTemplateDragHandle;
        const target = event.target;
        const fromDragHandle =
            target && target.closest ? target.closest(`.${dragHandleClass}`) : null;

        // Drag started from the explicit handle; let handle-level listener own it.
        if (fromDragHandle) return;

        const interactiveTarget =
            target && target.closest
                ? target.closest('textarea, input, select, option, button, a, [contenteditable="true"]')
                : null;

        if (interactiveTarget) {
            event.preventDefault();
            return;
        }

        onHandleDragStart(event, item.id);
    };

    const handleCellPointerDownCapture = event => {
        event.stopPropagation();
    };

    return (
        <div
            className={classNames.join(' ')}
            data-item-id={item.id}
            draggable
            onPointerDownCapture={handleCellPointerDownCapture}
            onMouseDownCapture={handleCellPointerDownCapture}
            onDragStart={handleCellDragStart}
            onDragEnd={onHandleDragEnd}
            onDragOver={event => onCellDragOver(event, item.id)}
            onDrop={event => onCellDrop(event, item.id)}
        >
            <div className={styles.notepadTemplateCellControls}>
                <button
                    type="button"
                    draggable
                    className={styles.notepadTemplateDragHandle}
                    onDragStart={event => onHandleDragStart(event, item.id)}
                    onDragEnd={onHandleDragEnd}
                    aria-label="Reorder item"
                    title="Drag to reorder"
                >
                    <span className={styles.notepadTemplateDragHandleDots}>
                        <span className={styles.notepadTemplateDragHandleDot} />
                        <span className={styles.notepadTemplateDragHandleDot} />
                        <span className={styles.notepadTemplateDragHandleDot} />
                        <span className={styles.notepadTemplateDragHandleDot} />
                        <span className={styles.notepadTemplateDragHandleDot} />
                        <span className={styles.notepadTemplateDragHandleDot} />
                    </span>
                </button>

                <button
                    type="button"
                    className={styles.notepadTemplateDeleteButton}
                    onClick={() => onDelete(item.id)}
                    aria-label="Delete item"
                    title="Delete item"
                >
                    x
                </button>
            </div>

            <div className={styles.notepadTemplateListCellBody}>
                {customContent || (item.type === 'placeholder' ? (
                    <div
                        className={styles.notepadTemplatePlaceholderCell}
                        style={{
                            backgroundColor: `${getSourceColor(item.sourceNodeType)}`,
                            borderColor: getSourceColor(item.sourceNodeType),
                            color: '#ffffff'
                        }}
                    >
                        {PlaceholderIcon ? (
                            <PlaceholderIcon className={styles.notepadTemplatePlaceholderIcon} />
                        ) : null}
                        {item.label || 'Source'}
                    </div>
                ) : (
                    <textarea
                        ref={textAreaRef}
                        className={styles.notepadTemplateCellTextInput}
                        value={item.content || ''}
                        onChange={event => onTextChange(item.id, event.target.value)}
                        onInput={handleTextInput}
                        placeholder={placeholder || 'Type text...'}
                        rows={1}
                    />
                ))}
            </div>
        </div>
    );
};

const NotepadTemplateRow = ({
    placeholder = 'Write prompt text...',
    value,
    onChange,
    id,
    upstreamSources = [],
    renderListCell
}) => {
    const [listItems, setListItems] = useState(() => normalizeListItems(value));
    const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
    const [dragState, setDragState] = useState({
        dragId: null,
        overId: null,
        insertAfter: false
    });
    const addMenuRef = useRef(null);
    const lastNormalizationMismatchRef = useRef(null);

    useEffect(() => {
        const normalizedValueItems = normalizeListItems(value);
        setListItems(prevItems => (
            areListItemsEqual(prevItems, normalizedValueItems) ? prevItems : normalizedValueItems
        ));
    }, [value]);

    const sourceOptions = useMemo(() => {
        const raw = Array.isArray(upstreamSources) ? upstreamSources.filter(Boolean) : [];
        const dedup = new Map();

        raw.forEach(source => {
            const key = `${source.sourceNodeId || ''}:${source.sourcePortId || 'out_value'}`;
            if (!dedup.has(key)) {
                dedup.set(key, {
                    sourceNodeId: String(source.sourceNodeId || ''),
                    sourcePortId: String(source.sourcePortId || 'out_value'),
                    label: String(toSourceLabel(source)),
                    sourceNodeType: String(source.sourceNodeType || ''),
                    resolverField: source.resolverFieldUsed ? String(source.resolverFieldUsed) : null
                });
            }
        });

        return Array.from(dedup.values());
    }, [upstreamSources]);

    useEffect(() => {
        if (!isAddMenuOpen) return undefined;

        const handlePointerDown = event => {
            if (!addMenuRef.current) return;
            if (addMenuRef.current.contains(event.target)) return;
            setIsAddMenuOpen(false);
        };

        const handleKeyDown = event => {
            if (event.key === 'Escape') {
                setIsAddMenuOpen(false);
            }
        };

        // Capture phase ensures we still close even if inner handlers stop propagation.
        document.addEventListener('pointerdown', handlePointerDown, true);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown, true);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isAddMenuOpen]);

    const applyListItems = useCallback(nextItems => {
        setListItems(nextItems);
        if (onChange) {
            onChange(toNextTemplateValue(value, nextItems));
        }
    }, [onChange, value]);

    useEffect(() => {
        if (!onChange) return;
        if (!Array.isArray(value?.listItems)) return;

        const normalizedItems = normalizeListItems(value);
        const expected = buildSegmentSignatureFromListItems(normalizedItems);
        const current = buildSegmentSignatureFromTemplate(value);

        const expectedSerialized = JSON.stringify(expected);
        const currentSerialized = JSON.stringify(current);

        if (expectedSerialized === currentSerialized) {
            lastNormalizationMismatchRef.current = null;
            return;
        }

        const mismatchKey = `${expectedSerialized}::${currentSerialized}`;
        if (lastNormalizationMismatchRef.current === mismatchKey) return;

        lastNormalizationMismatchRef.current = mismatchKey;
        onChange(toNextTemplateValue(value, normalizedItems));
    }, [onChange, value]);

    useEffect(() => {
        const syncedItems = syncPlaceholdersWithSources(listItems, sourceOptions);
        if (syncedItems !== listItems) {
            applyListItems(syncedItems);
        }
    }, [applyListItems, listItems, sourceOptions]);

    const handleAddTextItem = useCallback(() => {
        const nextItems = listItems.concat([{id: createItemId(), type: 'text', content: ''}]);
        applyListItems(nextItems);
        setIsAddMenuOpen(false);
    }, [applyListItems, listItems]);

    const handleAddSourceItem = useCallback(source => {
        const nextItems = listItems.concat([{
            id: createItemId(),
            type: 'placeholder',
            sourceNodeId: source.sourceNodeId,
            sourcePortId: source.sourcePortId || 'out_value',
            label: source.label || toSourceLabel(source),
            sourceNodeType: source.sourceNodeType || '',
            resolverField: source.resolverField || null
        }]);
        applyListItems(nextItems);
        setIsAddMenuOpen(false);
    }, [applyListItems, listItems]);

    const handleToggleAddMenu = useCallback(() => {
        setIsAddMenuOpen(prev => !prev);
    }, []);

    const handleDeleteItem = useCallback(itemId => {
        const nextItems = listItems.filter(item => item.id !== itemId);
        applyListItems(nextItems);
    }, [applyListItems, listItems]);

    const handleTextCellChange = useCallback((itemId, nextText) => {
        const nextItems = listItems.map(item => {
            if (item.id !== itemId) return item;
            if (item.type !== 'text') return item;
            return {...item, content: nextText};
        });
        applyListItems(nextItems);
    }, [applyListItems, listItems]);

    const handleHandleDragStart = useCallback((event, dragId) => {
        event.stopPropagation();
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', dragId);

        setDragState({
            dragId,
            overId: null,
            insertAfter: false
        });
    }, []);

    const handleHandleDragEnd = useCallback(() => {
        setDragState({
            dragId: null,
            overId: null,
            insertAfter: false
        });
    }, []);

    const handleCellDragOver = useCallback((event, overId) => {
        if (!dragState.dragId) return;

        event.stopPropagation();
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';

        if (dragState.dragId === overId) return;

        const rect = event.currentTarget.getBoundingClientRect();
        const insertAfter = event.clientY > rect.top + rect.height / 2;

        setDragState(prev => {
            if (prev.overId === overId && prev.insertAfter === insertAfter) return prev;

            return {
                ...prev,
                overId,
                insertAfter
            };
        });
    }, [dragState.dragId]);

    const handleBoardDragOver = useCallback(event => {
        if (!dragState.dragId) return;

        event.stopPropagation();
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, [dragState.dragId]);

    const handleCellDrop = useCallback((event, overId) => {
        event.stopPropagation();
        event.preventDefault();

        const dragId = dragState.dragId || event.dataTransfer.getData('text/plain');
        if (!dragId || dragId === overId) {
            handleHandleDragEnd();
            return;
        }

        const rect = event.currentTarget.getBoundingClientRect();
        const fallbackInsertAfter = event.clientY > rect.top + rect.height / 2;
        const insertAfter =
            dragState.overId === overId ? dragState.insertAfter : fallbackInsertAfter;

        const nextItems = reorderListItems(listItems, dragId, overId, insertAfter);
        applyListItems(nextItems);

        handleHandleDragEnd();
    }, [applyListItems, dragState, handleHandleDragEnd, listItems]);

    const handleBoardDrop = useCallback(event => {
        if (!dragState.dragId) return;

        event.stopPropagation();
        event.preventDefault();

        const dragId = dragState.dragId || event.dataTransfer.getData('text/plain');
        if (!dragId) {
            handleHandleDragEnd();
            return;
        }

        let nextItems = listItems;

        if (dragState.overId) {
            nextItems = reorderListItems(listItems, dragId, dragState.overId, dragState.insertAfter);
        } else {
            const fromIndex = listItems.findIndex(item => item.id === dragId);
            if (fromIndex >= 0 && fromIndex < listItems.length - 1) {
                nextItems = listItems.slice();
                const [draggedItem] = nextItems.splice(fromIndex, 1);
                nextItems.push(draggedItem);
            }
        }

        if (nextItems !== listItems) {
            applyListItems(nextItems);
        }

        handleHandleDragEnd();
    }, [applyListItems, dragState, handleHandleDragEnd, listItems]);

    return (
        <div className={styles.notepadTemplateRow} data-id={id}>
            <div
                className={styles.notepadTemplateBoard}
                onDragOver={handleBoardDragOver}
                onDrop={handleBoardDrop}
            >
                {listItems.map((item, index) => (
                    <NotepadListCell
                        key={item.id}
                        item={item}
                        index={index}
                        placeholder={placeholder}
                        renderListCell={renderListCell}
                        onDelete={handleDeleteItem}
                        onTextChange={handleTextCellChange}
                        onHandleDragStart={handleHandleDragStart}
                        onHandleDragEnd={handleHandleDragEnd}
                        onCellDragOver={handleCellDragOver}
                        onCellDrop={handleCellDrop}
                        isDragging={dragState.dragId === item.id}
                        isDropBefore={dragState.overId === item.id && !dragState.insertAfter}
                        isDropAfter={dragState.overId === item.id && dragState.insertAfter}
                    />
                ))}

                <div className={styles.notepadTemplateAddWrap} ref={addMenuRef}>
                    <button
                        type="button"
                        className={styles.notepadTemplateAddButton}
                        onClick={handleToggleAddMenu}
                        aria-label="Add list item"
                        title="Add list item"
                    >
                        +
                    </button>

                    {isAddMenuOpen ? (
                        <div className={styles.notepadTemplateAddMenu} role="menu" aria-label="Add cell type">
                            <button
                                type="button"
                                className={styles.notepadTemplateAddMenuItem}
                                onClick={handleAddTextItem}
                                role="menuitem"
                            >
                                Add text
                            </button>

                            {sourceOptions.map(source => (
                                <button
                                    key={`${source.sourceNodeId}:${source.sourcePortId}`}
                                    type="button"
                                    className={styles.notepadTemplateAddMenuItem}
                                    onClick={() => handleAddSourceItem(source)}
                                    role="menuitem"
                                >
                                    <span
                                        className={styles.notepadTemplateAddMenuSwatch}
                                        style={{backgroundColor: getSourceColor(source.sourceNodeType)}}
                                    />
                                    {source.label}
                                </button>
                            ))}
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

export default NotepadTemplateRow;