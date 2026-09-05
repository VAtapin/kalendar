import { describe, expect, it } from 'vitest';
import { createBlankA3Page } from '../src/document/factories';
import { createElementOnOwnLayer } from '../src/editor/element-creation';
import { emptyPhotoFrameAt, clearPhotoFrameImage } from '../src/document/photo-drop';

describe('photo library drops', () => {
  it('clears a filled frame once, preserves its geometry, and leaves standalone photos for ordinary deletion', () => {
    const page = createBlankA3Page();
    const {element} = createElementOnOwnLayer(page,'image',{x:10,y:20,width:100,height:60});
    if (element.type !== 'image') throw new Error('Expected image');
    element.assetId = 'photo';
    expect(clearPhotoFrameImage(element)).toBe(false);
    element.photoFrame = true;
    expect(clearPhotoFrameImage(element)).toBe(true);
    expect(element).toMatchObject({assetId:'',x:10,y:20,width:100,height:60,photoFrame:true});
    expect(clearPhotoFrameImage(element)).toBe(false);
  });
  it('targets empty frames but not free space or filled images', () => {
    const page = createBlankA3Page();
    const {element} = createElementOnOwnLayer(page,'image',{x:10,y:20,width:100,height:60});
    expect(emptyPhotoFrameAt(page,{x:50,y:50})).toBe(element);
    expect(emptyPhotoFrameAt(page,{x:200,y:200})).toBeUndefined();
    if (element.type === 'image') element.assetId = 'photo';
    expect(emptyPhotoFrameAt(page,{x:50,y:50})).toBeUndefined();
  });
  it('does not fill an empty frame underneath an existing photograph', () => {
    const page = createBlankA3Page();
    const lower = createElementOnOwnLayer(page,'image',{x:0,y:0,width:200,height:200});
    const upper = createElementOnOwnLayer(page,'image',{x:10,y:10,width:50,height:50});
    if (upper.element.type === 'image') upper.element.assetId = 'existing';
    expect(emptyPhotoFrameAt(page,{x:20,y:20})).toBeUndefined();
    expect(emptyPhotoFrameAt(page,{x:100,y:100})).toBe(lower.element);
  });
  it('respects rotation, hidden layers and locked layers', () => {
    const page = createBlankA3Page();
    const {element,layer} = createElementOnOwnLayer(page,'image',{x:10,y:10,width:100,height:20});
    element.rotation = 90;
    expect(emptyPhotoFrameAt(page,{x:60,y:50})).toBe(element);
    expect(emptyPhotoFrameAt(page,{x:15,y:20})).toBeUndefined();
    layer.locked = true; expect(emptyPhotoFrameAt(page,{x:60,y:20})).toBeUndefined();
    layer.locked = false; layer.visible = false; expect(emptyPhotoFrameAt(page,{x:60,y:20})).toBeUndefined();
  });
});
